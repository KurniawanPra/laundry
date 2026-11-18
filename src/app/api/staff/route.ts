import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { ApiError, errorResponse, parseJsonBody, requireApiUser } from '@/lib/api-utils';
import { getFeatureLimit } from '@/lib/entitlements';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { staffInputSchema } from '@/lib/laundry-validation';

export async function GET() {
  const auth = await requireApiUser(['OWNER']);
  if (auth.response) return auth.response;

  const staffWhere: Prisma.UserWhereInput = {};
  if (auth.user.role !== 'SUPER_OWNER' || auth.user.tenantId) {
    staffWhere.tenantId = auth.user.tenantId ?? -1;
  }

  const staff = await prisma.user.findMany({
    where: staffWhere,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      ownedStores: { select: { id: true, name: true, code: true } },
      storeMemberships: {
        select: {
          store: { select: { id: true, name: true, code: true } },
          role: true,
        },
      },
    },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });
  return NextResponse.json(staff);
}

export async function POST(request: Request) {
  const auth = await requireApiUser(['OWNER']);
  if (auth.response) return auth.response;
  const parsed = await parseJsonBody(request, staffInputSchema);
  if (parsed.response) return parsed.response;

  try {
    const effectiveTenantId = auth.user.tenantId ?? 1;
    const staffLimit = await getFeatureLimit(effectiveTenantId, 'staff.limit');
    if (staffLimit !== -1) {
      const currentStaffCount = await prisma.user.count({
        where: { tenantId: effectiveTenantId, isActive: true },
      });
      if (currentStaffCount >= staffLimit) {
        throw new ApiError(
          `Batas kuota staf (${staffLimit}) untuk paket Anda telah tercapai. Silakan upgrade paket untuk menambah staf baru.`,
          403,
        );
      }
    }

    const targetStoreId = parsed.data.storeId ?? auth.user.activeStoreId ?? (auth.user.stores[0]?.id ?? null);
    const user = await prisma.user.create({
      data: {
        tenantId: effectiveTenantId,
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        passwordHash: await hashPassword(parsed.data.password),
        role: parsed.data.role,
        ...(targetStoreId
          ? {
              storeMemberships: {
                create: { storeId: targetStoreId, role: parsed.data.role },
              },
            }
          : {}),
      },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return errorResponse(new ApiError('Email sudah terdaftar.', 409), '');
    }
    return errorResponse(error, 'Gagal menambahkan akun petugas.');
  }
}
