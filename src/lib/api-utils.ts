import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser, hasRole } from '@/lib/auth';
import { DomainError } from '@/lib/laundry-domain';
import { getTenantPrisma, ScopedPrismaClient } from '@/lib/tenant-context';
import type { UserRole } from '@/lib/laundry-domain';
import type { CurrentUser } from '@/lib/auth';

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
  if (roles && !hasRole(user.role, roles)) {
    return {
      user: null,
      response: NextResponse.json({ error: 'Anda tidak memiliki izin untuk tindakan ini.' }, { status: 403 }),
    };
  }
  return { user, response: null };
}

/**
 * Enforces authenticated user AND active tenant context with isolated Prisma client.
 * Also checks tenant suspension and expiration (read-only enforcement).
 */
export async function requireTenantApiUser(
  roles?: UserRole[],
  options?: { isWriteOperation?: boolean },
) {
  const auth = await requireApiUser(roles);
  if (auth.response || !auth.user) {
    return {
      user: null as unknown as CurrentUser,
      tenantId: 0,
      scopedPrisma: null as unknown as ScopedPrismaClient,
      response: auth.response,
    };
  }

  const user = auth.user;
  const tenantId = user.tenantId;

  if (!tenantId) {
    // If SUPER_OWNER without impersonating, they have no specific tenant scope
    return {
      user,
      tenantId: 0,
      scopedPrisma: null as unknown as ScopedPrismaClient,
      response: NextResponse.json(
        { error: 'Konteks toko (tenant) tidak ditemukan atau belum dipilih.' },
        { status: 400 },
      ),
    };
  }

  // Tenant Status Enforcement
  if (user.tenant?.status === 'SUSPENDED') {
    return {
      user,
      tenantId,
      scopedPrisma: null as unknown as ScopedPrismaClient,
      response: NextResponse.json(
        { error: 'Akun toko Anda sedang disuspend. Silakan hubungi admin platform.', code: 'tenant_suspended' },
        { status: 403 },
      ),
    };
  }

  if (user.tenant?.status === 'EXPIRED' && options?.isWriteOperation) {
    return {
      user,
      tenantId,
      scopedPrisma: null as unknown as ScopedPrismaClient,
      response: NextResponse.json(
        {
          error: 'Masa aktif langganan toko telah berakhir. Sistem dalam mode baca-saja.',
          code: 'tenant_expired_read_only',
        },
        { status: 403 },
      ),
    };
  }

  return {
    user,
    tenantId,
    scopedPrisma: getTenantPrisma(tenantId),
    response: null,
  };
}

export function errorResponse(error: unknown, fallback: string) {
  if (error instanceof DomainError || error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error instanceof ApiError ? error.status : 422 });
  }
  console.error(error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
