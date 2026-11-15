import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { ApiError, errorResponse, parseJsonBody, requireApiUser } from '@/lib/api-utils';
import { getBusinessDateRange, todayBusinessDate } from '@/lib/business-date';
import { prisma } from '@/lib/prisma';
import { cashClosureInputSchema } from '@/lib/laundry-validation';

export async function GET(request: Request) {
  const auth = await requireApiUser(['OWNER', 'CASHIER']);
  if (auth.response) return auth.response;

  try {
    const url = new URL(request.url);
    const { date, businessDate, start, end } = getBusinessDateRange(
      url.searchParams.get('date') ?? todayBusinessDate(),
    );
    const closures = await prisma.cashClosure.findMany({
      where: { businessDate },
      include: { staff: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const totals = await prisma.payment.groupBy({
      by: ['method'],
      where: { paidAt: { gte: start, lt: end } },
      _sum: { amount: true },
    });
    return NextResponse.json({ date, closures, paymentTotals: totals });
  } catch (error) {
    return errorResponse(error, 'Gagal mengambil tutup kas.');
  }
}

export async function POST(request: Request) {
  const auth = await requireApiUser(['OWNER', 'CASHIER']);
  if (auth.response) return auth.response;
  const parsed = await parseJsonBody(request, cashClosureInputSchema);
  if (parsed.response) return parsed.response;

  try {
    const { businessDate, start, end } = getBusinessDateRange(parsed.data.businessDate);
    const [payments, orderCount] = await Promise.all([
      prisma.payment.groupBy({
        by: ['method'],
        where: { paidAt: { gte: start, lt: end } },
        _sum: { amount: true },
      }),
      prisma.order.count({ where: { createdAt: { gte: start, lt: end } } }),
    ]);
    const amounts = { CASH: 0, TRANSFER: 0, QRIS: 0 };
    for (const payment of payments) amounts[payment.method] = payment._sum.amount ?? 0;
    const closure = await prisma.cashClosure.create({
      data: {
        businessDate,
        staffId: auth.user.id,
        orderCount,
        cashTotal: amounts.CASH,
        transferTotal: amounts.TRANSFER,
        qrisTotal: amounts.QRIS,
        cashCounted: parsed.data.cashCounted,
        cashDifference: parsed.data.cashCounted - amounts.CASH,
        notes: parsed.data.notes || null,
      },
      include: { staff: { select: { id: true, name: true } } },
    });
    return NextResponse.json(closure, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return errorResponse(new ApiError('Kasir ini sudah menutup kas pada tanggal tersebut.', 409), '');
    }
    return errorResponse(error, 'Gagal menyimpan tutup kas.');
  }
}
