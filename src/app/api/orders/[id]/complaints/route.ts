import { NextResponse } from 'next/server';
import { ApiError, errorResponse, parseJsonBody, requireApiUser } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { complaintInputSchema } from '@/lib/laundry-validation';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const { id: rawId } = await params;
  const orderId = Number(rawId);
  if (!Number.isSafeInteger(orderId) || orderId < 1) {
    return NextResponse.json({ error: 'ID pesanan tidak valid.' }, { status: 400 });
  }
  const complaints = await prisma.complaint.findMany({
    where: { orderId },
    include: { handledBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(complaints);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(['OWNER', 'CASHIER']);
  if (auth.response) return auth.response;
  const parsed = await parseJsonBody(request, complaintInputSchema);
  if (parsed.response) return parsed.response;
  const { id: rawId } = await params;
  const orderId = Number(rawId);
  if (!Number.isSafeInteger(orderId) || orderId < 1) {
    return NextResponse.json({ error: 'ID pesanan tidak valid.' }, { status: 400 });
  }

  try {
    const orderExists = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
    if (!orderExists) throw new ApiError('Pesanan tidak ditemukan.', 404);
    const complaint = await prisma.complaint.create({
      data: { orderId, ...parsed.data },
      include: { handledBy: { select: { id: true, name: true } } },
    });
    return NextResponse.json(complaint, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Gagal mencatat komplain.');
  }
}
