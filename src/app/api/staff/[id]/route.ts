import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { ApiError, errorResponse, parseJsonBody, requireApiUser } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { staffUpdateSchema } from '@/lib/laundry-validation';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(['OWNER']);
  if (auth.response) return auth.response;
  const parsed = await parseJsonBody(request, staffUpdateSchema);
  if (parsed.response) return parsed.response;
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID petugas tidak valid.' }, { status: 400 });
  }
  const data = parsed.data;

  try {
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw new ApiError('Akun petugas tidak ditemukan.', 404);
    if (target.id === auth.user.id && (data.isActive === false || data.role && data.role !== 'OWNER')) {
      throw new ApiError('Anda tidak dapat menonaktifkan atau menurunkan peran akun sendiri.', 400);
    }
    if (target.role === 'OWNER' && target.isActive &&
      (data.isActive === false || data.role && data.role !== 'OWNER')) {
      const activeOwners = await prisma.user.count({ where: { role: 'OWNER', isActive: true } });
      if (activeOwners <= 1) throw new ApiError('Minimal harus ada satu akun Pemilik aktif.', 409);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return errorResponse(new ApiError('Akun petugas tidak ditemukan.', 404), '');
    }
    return errorResponse(error, 'Gagal memperbarui akun petugas.');
  }
}
