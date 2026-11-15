import { NextResponse } from 'next/server';
import { errorResponse, requireApiUser } from '@/lib/api-utils';
import { getBusinessDateRange, todayBusinessDate } from '@/lib/business-date';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: 'uncollectedReadyDays' },
    });
    const uncollectedReadyDays = Number(setting?.value ?? 7);
    const { start, end } = getBusinessDateRange(todayBusinessDate());
    const now = new Date();
    const uncollectedBefore = new Date(now.getTime() - uncollectedReadyDays * 24 * 60 * 60 * 1000);

    const [readyUnpaid, overdue, readyOrders, orderCount, paymentTotals] = await Promise.all([
      prisma.order.findMany({
        where: { status: 'READY', paymentStatus: { not: 'PAID' } },
        select: { id: true, invoiceCode: true, totalAmount: true, paymentStatus: true, customer: { select: { name: true, phone: true } } },
        orderBy: { updatedAt: 'asc' },
      }),
      prisma.order.findMany({
        where: {
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
          estimatedDone: { lt: now },
        },
        select: { id: true, invoiceCode: true, status: true, estimatedDone: true, customer: { select: { name: true, phone: true } } },
        orderBy: { estimatedDone: 'asc' },
      }),
      prisma.order.findMany({
        where: { status: 'READY' },
        select: {
          id: true,
          invoiceCode: true,
          updatedAt: true,
          customer: { select: { name: true, phone: true } },
          statusLogs: {
            where: { toStatus: 'READY' },
            orderBy: { changedAt: 'desc' },
            take: 1,
            select: { changedAt: true },
          },
        },
      }),
      prisma.order.count({ where: { createdAt: { gte: start, lt: end } } }),
      prisma.payment.groupBy({
        by: ['method'],
        where: { paidAt: { gte: start, lt: end } },
        _sum: { amount: true },
      }),
    ]);
    const totals = { CASH: 0, TRANSFER: 0, QRIS: 0 };
    for (const payment of paymentTotals) totals[payment.method] = payment._sum.amount ?? 0;
    const uncollected = readyOrders.filter((order) => {
      const readyAt = order.statusLogs[0]?.changedAt ?? order.updatedAt;
      return readyAt <= uncollectedBefore;
    });

    return NextResponse.json({
      actions: { readyUnpaid, overdue, uncollected, uncollectedReadyDays },
      daily: {
        date: todayBusinessDate(),
        orderCount,
        paymentTotals: totals,
        totalPaid: totals.CASH + totals.TRANSFER + totals.QRIS,
      },
    });
  } catch (error) {
    return errorResponse(error, 'Gagal memuat ringkasan operasional.');
  }
}
