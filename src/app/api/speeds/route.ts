import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { ApiError, errorResponse, parseJsonBody, requireApiUser } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { speedInputSchema } from '@/lib/laundry-validation';

export async function GET() {
  const auth = await requireApiUser(['OWNER', 'CASHIER']);
  if (auth.response) return auth.response;

  try {
    const speeds = await prisma.laundrySpeed.findMany({
      where: auth.user.role === 'OWNER' ? undefined : { isActive: true },
      orderBy: { id: 'asc' },
    });
    return NextResponse.json(speeds);
  } catch (error) {
    return errorResponse(error, 'Gagal mengambil pilihan kecepatan laundry.');
  }
}

export async function POST(request: Request) {
  const auth = await requireApiUser(['OWNER']);
  if (auth.response) return auth.response;
  const parsed = await parseJsonBody(request, speedInputSchema);
  if (parsed.response) return parsed.response;

  try {
    const speed = await prisma.laundrySpeed.create({ data: parsed.data });
    return NextResponse.json(speed, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return errorResponse(new ApiError('Nama kecepatan sudah digunakan.', 409), '');
    }
    return errorResponse(error, 'Gagal menambahkan kecepatan laundry.');
  }
}
