import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { ApiError, errorResponse, parseJsonBody, requireApiUser } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { customerCreateSchema } from '@/lib/laundry-validation';

export async function GET(request: Request) {
  const auth = await requireApiUser(['OWNER', 'CASHIER']);
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const search = url.searchParams.get('search')?.trim() ?? '';
  const startDate = url.searchParams.get('startDate')?.trim();
  const endDate = url.searchParams.get('endDate')?.trim();

  try {
    const where: Prisma.CustomerWhereInput = {};
    if (auth.user.role !== 'SUPER_OWNER' || auth.user.tenantId) {
      where.tenantId = auth.user.tenantId ?? -1;
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
      ];
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(`${startDate}T00:00:00+07:00`);
      }
      if (endDate) {
        where.createdAt.lte = new Date(`${endDate}T23:59:59.999+07:00`);
      }
    }

    const customers = await prisma.customer.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: { _count: { select: { orders: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 200,
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
    const effectiveTenantId = auth.user.tenantId ?? 1;
    const existing = await prisma.customer.findFirst({
      where: {
        tenantId: effectiveTenantId,
        phone: parsed.data.phone,
      },
    });
    if (existing) throw new ApiError('Nomor telepon sudah terdaftar untuk toko Anda.', 409);
    const targetStoreId = auth.user.activeStoreId ?? (auth.user.stores[0]?.id ?? null);
    const customer = await prisma.customer.create({
      data: {
        ...parsed.data,
        tenantId: effectiveTenantId,
        storeId: targetStoreId,
      },
    });
    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return errorResponse(new ApiError('Nomor telepon sudah terdaftar.', 409), '');
    }
    return errorResponse(error, 'Gagal menambahkan pelanggan.');
  }
}
