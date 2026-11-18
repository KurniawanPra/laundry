import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export type SystemFeatureCode =
  | 'outlet.multi'
  | 'report.profit_loss'
  | 'export.excel'
  | 'notify.whatsapp'
  | 'staff.limit'
  | 'order.monthly_limit';

export const UNLIMITED_QUOTA = -1;

type CacheEntry = {
  value: string;
  cachedAt: number;
};

// In-memory cache: "tenantId:featureCode" -> CacheEntry (TTL 60 seconds)
const entitlementCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000;

export function invalidateTenantEntitlementCache(tenantId?: number) {
  if (tenantId !== undefined) {
    const prefix = `${tenantId}:`;
    for (const key of entitlementCache.keys()) {
      if (key.startsWith(prefix)) {
        entitlementCache.delete(key);
      }
    }
  } else {
    entitlementCache.clear();
  }
}

/**
 * Resolves the effective value of a feature for a tenant.
 * Priority:
 * 1. Active TenantFeatureOverride (ignored if expired)
 * 2. Active Tenant SubscriptionPlan -> PlanFeature
 * 3. FeatureDefinition.defaultValue
 * 4. Fallback default
 */
export async function getTenantEntitlement(
  tenantId: number,
  featureCode: string,
): Promise<string> {
  const cacheKey = `${tenantId}:${featureCode}`;
  const now = Date.now();
  const cached = entitlementCache.get(cacheKey);
  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return cached.value;
  }

  // 1. Check TenantFeatureOverride
  const override = await prisma.tenantFeatureOverride.findUnique({
    where: {
      tenantId_featureCode: { tenantId, featureCode },
    },
  });

  if (override) {
    // Requirement 3: Expired overrides must be ignored automatically
    const isExpired = override.expiresAt && override.expiresAt.getTime() <= now;
    if (!isExpired) {
      entitlementCache.set(cacheKey, { value: override.value, cachedAt: now });
      return override.value;
    }
  }

  // 2. Check PlanFeature via Tenant's SubscriptionPlan
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      planId: true,
      plan: {
        select: {
          id: true,
          isActive: true,
          features: {
            where: { featureCode },
            select: { value: true },
          },
        },
      },
    },
  });

  if (tenant?.plan?.isActive && tenant.plan.features.length > 0) {
    const planVal = tenant.plan.features[0].value;
    entitlementCache.set(cacheKey, { value: planVal, cachedAt: now });
    return planVal;
  }

  // 3. Check FeatureDefinition defaultValue
  const definition = await prisma.featureDefinition.findUnique({
    where: { code: featureCode },
    select: { defaultValue: true },
  });

  const resolvedValue = definition?.defaultValue ?? 'false';
  entitlementCache.set(cacheKey, { value: resolvedValue, cachedAt: now });
  return resolvedValue;
}

/**
 * Checks if a toggle feature is enabled for a tenant.
 */
export async function canUseFeature(
  tenantId: number,
  featureCode: string,
): Promise<boolean> {
  const val = await getTenantEntitlement(tenantId, featureCode);
  const normalized = val.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}

/**
 * Returns numeric quota for a feature.
 * Requirement 2: Returns -1 for UNLIMITED_QUOTA.
 */
export async function getFeatureLimit(
  tenantId: number,
  featureCode: string,
): Promise<number> {
  const val = await getTenantEntitlement(tenantId, featureCode);
  const parsed = parseInt(val.trim(), 10);
  if (isNaN(parsed)) return 0;
  return parsed; // -1 represents unlimited
}

/**
 * Requirement 4: Calculates the UTC start and end bounds of the current calendar month
 * strictly in the Asia/Jakarta (UTC+7) time zone.
 */
export function getJakartaMonthRange(referenceDate = new Date()): { start: Date; end: Date } {
  // Asia/Jakarta is fixed UTC+7 (no DST)
  const jakartaOffsetMs = 7 * 60 * 60 * 1000;
  const jakartaTime = new Date(referenceDate.getTime() + jakartaOffsetMs);

  const year = jakartaTime.getUTCFullYear();
  const month = jakartaTime.getUTCMonth(); // 0-indexed

  // Start of month: 1st day 00:00:00.000 in Jakarta
  // UTC = Jakarta - 7h
  const startUtcMs = Date.UTC(year, month, 1, 0, 0, 0, 0) - jakartaOffsetMs;

  // End of month: 1st day of next month 00:00:00.000 - 1ms in Jakarta
  const endUtcMs = Date.UTC(year, month + 1, 1, 0, 0, 0, 0) - jakartaOffsetMs - 1;

  return {
    start: new Date(startUtcMs),
    end: new Date(endUtcMs),
  };
}

/**
 * Checks atomic monthly quota using Asia/Jakarta timezone.
 */
export async function checkMonthlyOrderQuota(
  tenantId: number,
): Promise<{ allowed: boolean; limit: number; usage: number }> {
  const limit = await getFeatureLimit(tenantId, 'order.monthly_limit');
  if (limit === UNLIMITED_QUOTA) {
    return { allowed: true, limit: UNLIMITED_QUOTA, usage: 0 };
  }

  const { start, end } = getJakartaMonthRange();
  const usage = await prisma.order.count({
    where: {
      tenantId,
      createdAt: {
        gte: start,
        lte: end,
      },
    },
  });

  return {
    allowed: usage < limit,
    limit,
    usage,
  };
}

/**
 * Endpoint guard that rejects with 403 feature_not_available if disabled.
 */
export async function requireFeature(tenantId: number, featureCode: string) {
  const allowed = await canUseFeature(tenantId, featureCode);
  if (!allowed) {
    return NextResponse.json(
      {
        error: `Fitur '${featureCode}' tidak aktif dalam paket langganan Anda. Silakan hubungi Super Owner untuk upgrade.`,
        code: 'feature_not_available',
        featureCode,
        upgradeRequired: true,
      },
      { status: 403 },
    );
  }
  return null;
}
