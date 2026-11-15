import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { DomainError } from '@/lib/laundry-domain';
import type { UserRole } from '@/lib/laundry-domain';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function parseJsonBody<T>(request: Request, schema: z.ZodType<T>) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      data: null,
      response: NextResponse.json({ error: 'Format permintaan tidak valid.' }, { status: 400 }),
    };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      data: null,
      response: NextResponse.json(
        { error: 'Data yang dikirim tidak valid.', details: parsed.error.flatten() },
        { status: 400 },
      ),
    };
  }
  return { data: parsed.data, response: null };
}

export async function requireApiUser(roles?: UserRole[]) {
  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: 'Silakan masuk terlebih dahulu.' }, { status: 401 }),
    };
  }
  if (roles && !roles.includes(user.role)) {
    return {
      user: null,
      response: NextResponse.json({ error: 'Anda tidak memiliki izin untuk tindakan ini.' }, { status: 403 }),
    };
  }
  return { user, response: null };
}

export function errorResponse(error: unknown, fallback: string) {
  if (error instanceof DomainError || error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error instanceof ApiError ? error.status : 422 });
  }
  console.error(error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
