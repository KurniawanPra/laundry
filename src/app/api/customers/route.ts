import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { ApiError, errorResponse, parseJsonBody, requireApiUser } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { customerCreateSchema } from '@/lib/laundry-validation';

export async function GET(request: Request) {
  const auth = await requireApiUser(['OWNER', 'CASHIER']);
  if (auth.response) return auth.response;

  const search = new URL(request.url).searchParams.get('search')?.trim() ?? '';
  try {
    const customers = await prisma.customer.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search } },
              { phone: { contains: search } },
            ],
          }
        : undefined,
      include: { _count: { select: { orders: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return NextResponse.json(customers);
  } catch (error) {
    return errorResponse(error, 'Gagal mengambil data pelanggan.');
  }
}

export async function POST(request: Request) {
  const auth = await requireApiUser(['OWNER', 'CASHIER']);
  if (auth.response) return auth.response;
  const parsed = await parseJsonBody(request, customerCreateSchema);
  if (parsed.response) return parsed.response;

  try {
    const existing = await prisma.customer.findUnique({ where: { phone: parsed.data.phone } });
    if (existing) throw new ApiError('Nomor telepon sudah terdaftar.', 409);
    const customer = await prisma.customer.create({ data: parsed.data });
    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return errorResponse(new ApiError('Nomor telepon sudah terdaftar.', 409), '');
    }
    return errorResponse(error, 'Gagal menambahkan pelanggan.');
  }
}
