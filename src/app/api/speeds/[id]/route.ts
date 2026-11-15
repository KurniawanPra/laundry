import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { ApiError, errorResponse, parseJsonBody, requireApiUser } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { speedUpdateSchema } from '@/lib/laundry-validation';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(['OWNER']);
  if (auth.response) return auth.response;
  const parsed = await parseJsonBody(request, speedUpdateSchema);
  if (parsed.response) return parsed.response;

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID kecepatan tidak valid.' }, { status: 400 });
  }

  try {
    const speed = await prisma.$transaction(async (transaction) => {
      const current = await transaction.laundrySpeed.findUnique({ where: { id } });
      if (!current) throw new ApiError('Kecepatan tidak ditemukan.', 404);
      if (current.isActive && parsed.data.isActive === false) {
        const activeCount = await transaction.laundrySpeed.count({ where: { isActive: true } });
        if (activeCount <= 1) throw new ApiError('Minimal satu kecepatan harus tetap aktif.', 422);
      }
      return transaction.laundrySpeed.update({ where: { id }, data: parsed.data });
    });
    return NextResponse.json(speed);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return errorResponse(new ApiError('Nama kecepatan sudah digunakan.', 409), '');
    }
    return errorResponse(error, 'Gagal memperbarui kecepatan laundry.');
  }
}
