import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { errorResponse, requireApiUser } from '@/lib/api-utils';
import { getBusinessDateRange, todayBusinessDate } from '@/lib/business-date';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  try {
    const setting = await prisma.appSetting.findFirst({
      where: { key: 'uncollectedReadyDays' },
    });
    const uncollectedReadyDays = Number(setting?.value ?? 7);
    const { start, end } = getBusinessDateRange(todayBusinessDate());
    const now = new Date();
    const uncollectedBefore = new Date(now.getTime() - uncollectedReadyDays * 24 * 60 * 60 * 1000);

    const activeStoreId = auth.user.activeStoreId;
    const isGlobalSuperOwner = auth.user.role === 'SUPER_OWNER' && activeStoreId === null;

    // Filter store condition
    const storeOrderFilter: Prisma.OrderWhereInput = {};
    const storePaymentFilter: Prisma.PaymentWhereInput = {};

    if (auth.user.role !== 'SUPER_OWNER' || auth.user.tenantId) {
      storeOrderFilter.tenantId = auth.user.tenantId ?? -1;
      storePaymentFilter.tenantId = auth.user.tenantId ?? -1;
    }

    if (activeStoreId) {
      storeOrderFilter.storeId = activeStoreId;
      storePaymentFilter.order = { storeId: activeStoreId };
    }

    const [readyUnpaid, overdue, readyOrders, orderCount, paymentTotals] = await Promise.all([
      prisma.order.findMany({
        where: {
          ...storeOrderFilter,
          status: 'READY',
          paymentStatus: { not: 'PAID' },
        },
        select: {
          id: true,
          invoiceCode: true,
          totalAmount: true,
          paymentStatus: true,
          store: { select: { id: true, name: true, code: true } },
          customer: { select: { name: true, phone: true } },
        },
        orderBy: { updatedAt: 'asc' },
      }),
      prisma.order.findMany({
        where: {
          ...storeOrderFilter,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
          estimatedDone: { lt: now },
        },
        select: {
          id: true,
          invoiceCode: true,
          status: true,
          estimatedDone: true,
          store: { select: { id: true, name: true, code: true } },
          customer: { select: { name: true, phone: true } },
        },
        orderBy: { estimatedDone: 'asc' },
      }),
      prisma.order.findMany({
        where: {
          ...storeOrderFilter,
          status: 'READY',
        },
        select: {
          id: true,
          invoiceCode: true,
          updatedAt: true,
          store: { select: { id: true, name: true, code: true } },
          customer: { select: { name: true, phone: true } },
          statusLogs: {
            where: { toStatus: 'READY' },
            orderBy: { changedAt: 'desc' },
            take: 1,
            select: { changedAt: true },
          },
        },
      }),
      prisma.order.count({
        where: {
          ...storeOrderFilter,
          createdAt: { gte: start, lt: end },
        },
      }),
      prisma.payment.groupBy({
        by: ['method'],
        where: {
          ...storePaymentFilter,
          paidAt: { gte: start, lt: end },
        },
        _sum: { amount: true },
      }),
    ]);

    const totals = { CASH: 0, TRANSFER: 0, QRIS: 0 };
    for (const payment of paymentTotals) totals[payment.method] = payment._sum.amount ?? 0;

    const uncollected = readyOrders.filter((order) => {
      const readyAt = order.statusLogs[0]?.changedAt ?? order.updatedAt;
      return readyAt <= uncollectedBefore;
    });

    // Jika SUPER_OWNER dalam mode Global (Semua Toko), sediakan breakdown antar cabang
    let multiStoreOverview = null;
    if (isGlobalSuperOwner) {
      const stores = await prisma.store.findMany({
        where: { isActive: true },
        select: {
          id: true,
          code: true,
          name: true,
          address: true,
          owner: { select: { name: true, email: true } },
        },
        orderBy: { name: 'asc' },
      });

      const storesBreakdown = await Promise.all(
        stores.map(async (store) => {
          const [todayOrders, activeOrders, todayPayments] = await Promise.all([
            prisma.order.count({
              where: { storeId: store.id, createdAt: { gte: start, lt: end } },
            }),
            prisma.order.count({
              where: { storeId: store.id, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
            }),
            prisma.payment.aggregate({
              where: { order: { storeId: store.id }, paidAt: { gte: start, lt: end } },
              _sum: { amount: true },
            }),
          ]);

          return {
            id: store.id,
            code: store.code,
            name: store.name,
            address: store.address,
            ownerName: store.owner?.name ?? 'Belum ditentukan',
            todayOrders,
            activeOrders,
            todayRevenue: todayPayments._sum.amount ?? 0,
          };
        }),
      );

      multiStoreOverview = {
        isGlobal: true,
        totalStores: stores.length,
        storesBreakdown,
      };
    }

    return NextResponse.json({
      actions: { readyUnpaid, overdue, uncollected, uncollectedReadyDays },
      daily: {
        date: todayBusinessDate(),
        orderCount,
        paymentTotals: totals,
        totalPaid: totals.CASH + totals.TRANSFER + totals.QRIS,
      },
      activeStore: auth.user.activeStore,
      multiStore: multiStoreOverview,
    });
  } catch (error) {
    return errorResponse(error, 'Gagal memuat ringkasan operasional.');
  }
}
