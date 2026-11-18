import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { ApiError, errorResponse, parseJsonBody, requireApiUser } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { customerUpdateSchema } from '@/lib/laundry-validation';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(['OWNER', 'CASHIER']);
  if (auth.response) return auth.response;
  const parsed = await parseJsonBody(request, customerUpdateSchema);
  if (parsed.response) return parsed.response;
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID pelanggan tidak valid.' }, { status: 400 });
  }

  try {
    const customerWhere: Prisma.CustomerWhereInput = { id };
    if (auth.user.role !== 'SUPER_OWNER' || auth.user.tenantId) {
      customerWhere.tenantId = auth.user.tenantId ?? -1;
    }
    const target = await prisma.customer.findFirst({ where: customerWhere });
    if (!target) throw new ApiError('Pelanggan tidak ditemukan.', 404);

    const customer = await prisma.customer.update({
      where: { id },
      data: parsed.data,
      include: { _count: { select: { orders: true } } },
    });
    return NextResponse.json(customer);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return errorResponse(new ApiError('Pelanggan tidak ditemukan.', 404), '');
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return errorResponse(new ApiError('Nomor telepon sudah terdaftar.', 409), '');
    }
    return errorResponse(error, 'Gagal memperbarui pelanggan.');
  }
}
