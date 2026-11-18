import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import type { UserRole } from '@/lib/laundry-domain';

export const SESSION_COOKIE = 'laundry_session';
export const ACTIVE_STORE_COOKIE = 'laundry_active_store';
export const IMPERSONATE_TENANT_COOKIE = 'laundry_impersonate_tenant';
const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000;

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + sessionLifetimeMs);
  await prisma.session.create({
    data: { userId, tokenHash: tokenHash(token), expiresAt },
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: tokenHash(token) } });
  }
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(ACTIVE_STORE_COOKIE);
  cookieStore.delete(IMPERSONATE_TENANT_COOKIE);
}

export type StoreSummary = {
  id: number;
  code: string;
  name: string;
  address?: string | null;
  isActive?: boolean;
};

export type TenantSummary = {
  id: number;
  name: string;
  slug: string;
  status: 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
  trialEndsAt?: Date | null;
  planId?: number | null;
};

export type CurrentUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  tenantId: number | null;
  tenant: TenantSummary | null;
  isImpersonating?: boolean;
  activeStoreId: number | null;
  activeStore: StoreSummary | null;
  stores: StoreSummary[];
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: tokenHash(token) },
    select: {
      expiresAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          tenantId: true,
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              trialEndsAt: true,
              planId: true,
            },
          },
          ownedStores: {
            where: { isActive: true },
            select: { id: true, code: true, name: true, address: true, isActive: true },
          },
          storeMemberships: {
            where: { store: { isActive: true } },
            select: {
              store: { select: { id: true, code: true, name: true, address: true, isActive: true } },
            },
          },
        },
      },
    },
  });

  if (!session || session.expiresAt <= new Date() || !session.user.isActive) return null;

  const rawUser = session.user;
  let effectiveTenantId = rawUser.tenantId;
  let effectiveTenant: TenantSummary | null = rawUser.tenant;
  let isImpersonating = false;

  // Check if SUPER_OWNER is impersonating a tenant
  if (rawUser.role === 'SUPER_OWNER') {
    const impersonatedId = cookieStore.get(IMPERSONATE_TENANT_COOKIE)?.value;
    if (impersonatedId && !isNaN(Number(impersonatedId))) {
      const targetTenant = await prisma.tenant.findUnique({
        where: { id: Number(impersonatedId) },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          trialEndsAt: true,
          planId: true,
        },
      });
      if (targetTenant) {
        effectiveTenantId = targetTenant.id;
        effectiveTenant = targetTenant;
        isImpersonating = true;
      }
    }
  }

  let accessibleStores: StoreSummary[] = [];

  if (rawUser.role === 'SUPER_OWNER' && !effectiveTenantId) {
    // SUPER_OWNER global view
    accessibleStores = await prisma.store.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, address: true, isActive: true },
      orderBy: { name: 'asc' },
    });
  } else if (effectiveTenantId) {
    // Scoped strictly to the active/effective tenant
    accessibleStores = await prisma.store.findMany({
      where: { tenantId: effectiveTenantId, isActive: true },
      select: { id: true, code: true, name: true, address: true, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  // Tentukan activeStoreId berdasarkan cookie
  const activeStoreVal = cookieStore.get(ACTIVE_STORE_COOKIE)?.value;
  let activeStoreId: number | null = null;

  if (activeStoreVal === 'all' && rawUser.role === 'SUPER_OWNER' && !effectiveTenantId) {
    activeStoreId = null;
  } else if (activeStoreVal && !isNaN(Number(activeStoreVal))) {
    const requestedId = Number(activeStoreVal);
    if (accessibleStores.some((s) => s.id === requestedId)) {
      activeStoreId = requestedId;
    }
  }

  // Default fallback: toko pertama jika belum memilih
  if (activeStoreId === null && accessibleStores.length > 0) {
    activeStoreId = accessibleStores[0].id;
  }

  const activeStore = activeStoreId
    ? accessibleStores.find((s) => s.id === activeStoreId) ?? null
    : null;

  return {
    id: rawUser.id,
    name: rawUser.name,
    email: rawUser.email,
    role: rawUser.role,
    isActive: rawUser.isActive,
    tenantId: effectiveTenantId,
    tenant: effectiveTenant,
    isImpersonating,
    activeStoreId,
    activeStore,
    stores: accessibleStores,
  };
}

export function hasRole(role: UserRole, allowedRoles: UserRole[]) {
  if (role === 'SUPER_OWNER') return true;
  return allowedRoles.includes(role);
}
