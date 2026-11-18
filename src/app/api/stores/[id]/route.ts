import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { ApiError, errorResponse, parseJsonBody, requireApiUser } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { storeUpdateSchema } from '@/lib/laundry-validation';

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const storeId = Number(id);
  if (isNaN(storeId)) return NextResponse.json({ error: 'ID toko tidak valid.' }, { status: 400 });

  try {
    if (auth.user.role !== 'SUPER_OWNER' && !auth.user.stores.some((s) => s.id === storeId)) {
      return NextResponse.json({ error: 'Anda tidak memiliki hak akses ke toko ini.' }, { status: 403 });
    }

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        users: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true, isActive: true } },
          },
        },
        _count: {
          select: { orders: true, customers: true, services: true },
        },
      },
    });

    if (!store) return NextResponse.json({ error: 'Toko tidak ditemukan.' }, { status: 404 });
    return NextResponse.json(store);
  } catch (error) {
    return errorResponse(error, 'Gagal memuat informasi toko.');
  }
}

export async function PATCH(request: Request, context: Context) {
  const auth = await requireApiUser(['SUPER_OWNER']);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const storeId = Number(id);
  if (isNaN(storeId)) return NextResponse.json({ error: 'ID toko tidak valid.' }, { status: 400 });

  const parsed = await parseJsonBody(request, storeUpdateSchema);
  if (parsed.response) return parsed.response;

  try {
    const existing = await prisma.store.findUnique({ where: { id: storeId } });
    if (!existing) return NextResponse.json({ error: 'Toko tidak ditemukan.' }, { status: 404 });

    const data: Prisma.StoreUpdateInput = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.code !== undefined) data.code = parsed.data.code.toUpperCase();
    if (parsed.data.address !== undefined) data.address = parsed.data.address || null;
    if (parsed.data.phone !== undefined) data.phone = parsed.data.phone || null;
    if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;

    if (parsed.data.ownerId !== undefined) {
      if (parsed.data.ownerId === null) {
        data.owner = { disconnect: true };
      } else {
        const ownerUser = await prisma.user.findUnique({ where: { id: parsed.data.ownerId } });
        if (!ownerUser) throw new ApiError('Pengguna pemilik tidak ditemukan.', 404);
        data.owner = { connect: { id: parsed.data.ownerId } };

        // Pastikan role owner disetel
        if (ownerUser.role !== 'SUPER_OWNER' && ownerUser.role !== 'OWNER') {
          await prisma.user.update({
            where: { id: parsed.data.ownerId },
            data: { role: 'OWNER' },
          });
        }

        await prisma.storeUser.upsert({
          where: { userId_storeId: { userId: parsed.data.ownerId, storeId } },
          update: { role: 'OWNER' },
          create: { userId: parsed.data.ownerId, storeId, role: 'OWNER' },
        });
      }
    }

    const updated = await prisma.store.update({
      where: { id: storeId },
      data,
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return errorResponse(error, 'Gagal memperbarui toko.');
  }
}

export async function DELETE(_request: Request, context: Context) {
  const auth = await requireApiUser(['SUPER_OWNER']);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const storeId = Number(id);
  if (isNaN(storeId)) return NextResponse.json({ error: 'ID toko tidak valid.' }, { status: 400 });

  try {
    // Nonaktifkan toko (Soft delete)
    const store = await prisma.store.update({
      where: { id: storeId },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true, message: `Toko ${store.name} dinonaktifkan.` });
  } catch (error) {
    return errorResponse(error, 'Gagal menonaktifkan toko.');
  }
}
