import { NextResponse } from 'next/server';
import { errorResponse, requireApiUser } from '@/lib/api-utils';
import { getBusinessDateRange, todayBusinessDate } from '@/lib/business-date';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const auth = await requireApiUser(['OWNER', 'CASHIER']);
  if (auth.response) return auth.response;

  try {
    const url = new URL(request.url);
    const { date, start, end } = getBusinessDateRange(
      url.searchParams.get('date') ?? todayBusinessDate(),
    );
    const tenantFilter: { tenantId?: number } = {};
    if (auth.user.role !== 'SUPER_OWNER' || auth.user.tenantId) {
      tenantFilter.tenantId = auth.user.tenantId ?? -1;
    }
    const [orderCount, paymentTotals, payments] = await Promise.all([
      prisma.order.count({ where: { ...tenantFilter, createdAt: { gte: start, lt: end } } }),
      prisma.payment.groupBy({
        by: ['method'],
        where: { ...tenantFilter, paidAt: { gte: start, lt: end } },
        _sum: { amount: true },
      }),
      prisma.payment.findMany({
        where: { ...tenantFilter, paidAt: { gte: start, lt: end } },
        select: { orderId: true },
        distinct: ['orderId'],
      }),
    ]);

    const totals = { CASH: 0, TRANSFER: 0, QRIS: 0 };
    for (const payment of paymentTotals) totals[payment.method] = payment._sum.amount ?? 0;
    return NextResponse.json({
      date,
      orderCount,
      paidOrderCount: payments.length,
      paymentTotals: totals,
      totalPaid: totals.CASH + totals.TRANSFER + totals.QRIS,
    });
  } catch (error) {
    return errorResponse(error, 'Gagal mengambil laporan harian.');
  }
}
