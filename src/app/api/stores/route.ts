import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { ApiError, errorResponse, parseJsonBody, requireApiUser } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { storeInputSchema } from '@/lib/laundry-validation';

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  try {
    const isSuperOwner = auth.user.role === 'SUPER_OWNER';

    const whereClause: Prisma.StoreWhereInput = {};
    if (!isSuperOwner) {
      const allowedStoreIds = auth.user.stores.map((s) => s.id);
      whereClause.id = { in: allowedStoreIds };
    }

    const stores = await prisma.store.findMany({
      where: whereClause,
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: {
            orders: true,
            customers: true,
            services: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Untuk SUPER_OWNER, tambahkan ringkasan performa finansial per toko
    if (isSuperOwner) {
      const storeSummaries = await Promise.all(
        stores.map(async (store) => {
          const payments = await prisma.payment.aggregate({
            where: { order: { storeId: store.id } },
            _sum: { amount: true },
          });

          const activeOrders = await prisma.order.count({
            where: {
              storeId: store.id,
              status: { notIn: ['COMPLETED', 'CANCELLED'] },
            },
          });

          return {
            id: store.id,
            code: store.code,
            name: store.name,
            address: store.address,
            phone: store.phone,
            isActive: store.isActive,
            owner: store.owner,
            stats: {
              totalOrders: store._count.orders,
              activeOrders,
              totalCustomers: store._count.customers,
              totalServices: store._count.services,
              totalRevenue: payments._sum.amount ?? 0,
            },
            createdAt: store.createdAt,
          };
        }),
      );

      return NextResponse.json(storeSummaries);
    }

    return NextResponse.json(stores);
  } catch (error) {
    return errorResponse(error, 'Gagal memuat daftar toko.');
  }
}

export async function POST(request: Request) {
  const auth = await requireApiUser(['SUPER_OWNER']);
  if (auth.response) return auth.response;

  const parsed = await parseJsonBody(request, storeInputSchema);
  if (parsed.response) return parsed.response;

  const { name, code, address, phone, ownerId, isActive } = parsed.data;

  try {
    const effectiveTenantId =
      auth.user.tenantId ??
      (ownerId
        ? (await prisma.user.findUnique({ where: { id: ownerId }, select: { tenantId: true } }))?.tenantId ?? 1
        : 1);

    // Pastikan kode toko unik dalam tenant
    const existing = await prisma.store.findFirst({
      where: { tenantId: effectiveTenantId, code: code.toUpperCase() },
    });
    if (existing) {
      throw new ApiError('Kode toko sudah digunakan. Pilih kode lain.', 409);
    }

    // Jika ownerId diberikan, pastikan user ada dan set perannya menjadi OWNER jika belum
    if (ownerId) {
      const ownerUser = await prisma.user.findUnique({ where: { id: ownerId } });
      if (!ownerUser) throw new ApiError('Pengguna yang dipilih sebagai pemilik tidak ditemukan.', 404);
      if (ownerUser.role !== 'SUPER_OWNER' && ownerUser.role !== 'OWNER') {
        await prisma.user.update({
          where: { id: ownerId },
          data: { role: 'OWNER' },
        });
      }
    }

    const newStore = await prisma.store.create({
      data: {
        tenantId: effectiveTenantId,
        name,
        code: code.toUpperCase(),
        address: address || null,
        phone: phone || null,
        ownerId: ownerId || null,
        isActive: isActive ?? true,
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    // Otomatis salin layanan standar (template) dari Toko Pusat jika ada
    const templateServices = await prisma.service.findMany({
      where: { storeId: { not: null } },
      take: 7,
      include: { stages: true },
    });

    if (templateServices.length > 0) {
      for (const tpl of templateServices) {
        const createdSvc = await prisma.service.create({
          data: {
            name: tpl.name,
            unit: tpl.unit,
            unitCode: tpl.unitCode,
            price: tpl.price,
            regularPrice: tpl.regularPrice,
            expressPrice: tpl.expressPrice,
            durationHrs: tpl.durationHrs,
            expressDurationHrs: tpl.expressDurationHrs,
            isActive: tpl.isActive,
            storeId: newStore.id,
          },
        });

        if (tpl.stages.length > 0) {
          await prisma.serviceWorkflowStage.createMany({
            data: tpl.stages.map((st) => ({
              serviceId: createdSvc.id,
              stage: st.stage,
              position: st.position,
            })),
          });
        }
      }
    }

    // Buat keanggotaan storeUser jika ownerId ada
    if (ownerId) {
      await prisma.storeUser.upsert({
        where: { userId_storeId: { userId: ownerId, storeId: newStore.id } },
        update: { role: 'OWNER' },
        create: { userId: ownerId, storeId: newStore.id, role: 'OWNER' },
      });
    }

    return NextResponse.json(newStore, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return errorResponse(new ApiError('Kode toko sudah terdaftar.', 409), '');
    }
    return errorResponse(error, 'Gagal menambahkan toko baru.');
  }
}
