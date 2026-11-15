import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { ApiError, errorResponse, parseJsonBody, requireApiUser } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { staffInputSchema } from '@/lib/laundry-validation';

export async function GET() {
  const auth = await requireApiUser(['OWNER']);
  if (auth.response) return auth.response;

  const staff = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
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
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        passwordHash: await hashPassword(parsed.data.password),
        role: parsed.data.role,
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
