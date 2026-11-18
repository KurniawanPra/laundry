import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { requireApiUser, parseJsonBody, errorResponse } from '@/lib/api-utils';
import { ACTIVE_STORE_COOKIE } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const selectStoreSchema = z.object({
  storeId: z.union([z.number().int().positive(), z.literal('all'), z.null()]),
});

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const parsed = await parseJsonBody(request, selectStoreSchema);
  if (parsed.response) return parsed.response;

  const { storeId } = parsed.data;
  const cookieStore = await cookies();

  try {
    if (storeId === 'all' || storeId === null) {
      if (auth.user.role !== 'SUPER_OWNER') {
        return NextResponse.json(
          { error: 'Hanya Super Owner yang dapat melihat agregat semua toko.' },
          { status: 403 },
        );
      }
      cookieStore.set(ACTIVE_STORE_COOKIE, 'all', {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
      });
      return NextResponse.json({ success: true, activeStoreId: null, message: 'Beralih ke ringkasan semua toko' });
    }

    // Periksa apakah toko valid
    const store = await prisma.store.findUnique({
      where: { id: storeId, isActive: true },
      select: { id: true, name: true, code: true },
    });

    if (!store) {
      return NextResponse.json({ error: 'Toko tidak ditemukan atau tidak aktif.' }, { status: 404 });
    }

    // Jika bukan SUPER_OWNER, pastikan user berhak mengakses toko ini
    if (auth.user.role !== 'SUPER_OWNER') {
      const hasAccess = auth.user.stores.some((s) => s.id === storeId);
      if (!hasAccess) {
        return NextResponse.json({ error: 'Anda tidak memiliki hak akses ke toko ini.' }, { status: 403 });
      }
    }

    cookieStore.set(ACTIVE_STORE_COOKIE, String(store.id), {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    });

    return NextResponse.json({
      success: true,
      activeStoreId: store.id,
      store,
      message: `Beralih ke toko ${store.name}`,
    });
  } catch (error) {
    return errorResponse(error, 'Gagal memilih toko.');
  }
}
