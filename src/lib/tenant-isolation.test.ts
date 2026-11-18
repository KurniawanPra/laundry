import assert from 'node:assert/strict';
import test from 'node:test';
import { prisma } from './prisma';
import { getTenantPrisma } from './tenant-context';
import {
  canUseFeature,
  getFeatureLimit,
  getJakartaMonthRange,
  invalidateTenantEntitlementCache,
  UNLIMITED_QUOTA,
} from './entitlements';
import { hashPassword } from './password';

test('Multi-Tenant Data Isolation & Entitlement Test Suite', async (t) => {
  let tenantAId: number;
  let tenantBId: number;
  let customerAId: number;
  let customerBId: number;
  let orderAId: number;
  let orderBId: number;
  let planBasicId: number;
  let planProId: number;

  await t.test('Setup: Create 2 Test Tenants, Plans, and Initial Data', async () => {
    // 1. Create Test Plans
    const planBasic = await prisma.subscriptionPlan.upsert({
      where: { code: 'TEST_PLAN_BASIC' },
      update: {},
      create: {
        code: 'TEST_PLAN_BASIC',
        name: 'Test Plan Basic',
        price: 50000,
        billingCycle: 'MONTHLY',
      },
    });
    planBasicId = planBasic.id;

    const planPro = await prisma.subscriptionPlan.upsert({
      where: { code: 'TEST_PLAN_PRO' },
      update: {},
      create: {
        code: 'TEST_PLAN_PRO',
        name: 'Test Plan Pro',
        price: 150000,
        billingCycle: 'MONTHLY',
      },
    });
    planProId = planPro.id;

    // Plan Features
    await prisma.planFeature.upsert({
      where: { planId_featureCode: { planId: planBasicId, featureCode: 'report.profit_loss' } },
      update: { value: 'false' },
      create: { planId: planBasicId, featureCode: 'report.profit_loss', value: 'false' },
    });
    await prisma.planFeature.upsert({
      where: { planId_featureCode: { planId: planProId, featureCode: 'report.profit_loss' } },
      update: { value: 'true' },
      create: { planId: planProId, featureCode: 'report.profit_loss', value: 'true' },
    });
    await prisma.planFeature.upsert({
      where: { planId_featureCode: { planId: planBasicId, featureCode: 'order.monthly_limit' } },
      update: { value: '100' },
      create: { planId: planBasicId, featureCode: 'order.monthly_limit', value: '100' },
    });
    await prisma.planFeature.upsert({
      where: { planId_featureCode: { planId: planProId, featureCode: 'order.monthly_limit' } },
      update: { value: '-1' },
      create: { planId: planProId, featureCode: 'order.monthly_limit', value: '-1' },
    });

    // 2. Create Tenants
    const tenantA = await prisma.tenant.upsert({
      where: { slug: 'test-tenant-a' },
      update: { planId: planBasicId, status: 'ACTIVE' },
      create: {
        name: 'Laundry Mitra A (Test)',
        slug: 'test-tenant-a',
        status: 'ACTIVE',
        planId: planBasicId,
      },
    });
    tenantAId = tenantA.id;

    const tenantB = await prisma.tenant.upsert({
      where: { slug: 'test-tenant-b' },
      update: { planId: planProId, status: 'ACTIVE' },
      create: {
        name: 'Laundry Mitra B (Test)',
        slug: 'test-tenant-b',
        status: 'ACTIVE',
        planId: planProId,
      },
    });
    tenantBId = tenantB.id;

    // 3. Create Stores for A & B
    const storeA = await prisma.store.upsert({
      where: { tenantId_code: { tenantId: tenantAId, code: 'TSTA-01' } },
      update: {},
      create: {
        tenantId: tenantAId,
        code: 'TSTA-01',
        name: 'Outlet A1',
      },
    });

    const storeB = await prisma.store.upsert({
      where: { tenantId_code: { tenantId: tenantBId, code: 'TSTB-01' } },
      update: {},
      create: {
        tenantId: tenantBId,
        code: 'TSTB-01',
        name: 'Outlet B1',
      },
    });

    // 4. Create Users for A & B
    const pwdHash = await hashPassword('password123');
    await prisma.user.upsert({
      where: { email: 'owner-a@test.com' },
      update: { tenantId: tenantAId },
      create: {
        name: 'Owner A',
        email: 'owner-a@test.com',
        passwordHash: pwdHash,
        role: 'OWNER',
        tenantId: tenantAId,
      },
    });

    await prisma.user.upsert({
      where: { email: 'owner-b@test.com' },
      update: { tenantId: tenantBId },
      create: {
        name: 'Owner B',
        email: 'owner-b@test.com',
        passwordHash: pwdHash,
        role: 'OWNER',
        tenantId: tenantBId,
      },
    });

    // 5. Create Customer for A & B
    const custA = await prisma.customer.create({
      data: {
        tenantId: tenantAId,
        storeId: storeA.id,
        name: 'Pelanggan Rahasia A',
        phone: '081100000001',
      },
    });
    customerAId = custA.id;

    const custB = await prisma.customer.create({
      data: {
        tenantId: tenantBId,
        storeId: storeB.id,
        name: 'Pelanggan Rahasia B',
        phone: '081100000002',
      },
    });
    customerBId = custB.id;

    // 6. Create Service for A & B
    const servA = await prisma.service.create({
      data: {
        tenantId: tenantAId,
        storeId: storeA.id,
        name: 'Cuci A',
        unit: 'kg',
        unitCode: 'PER_KG',
        price: 7000,
        regularPrice: 7000,
      },
    });

    const servB = await prisma.service.create({
      data: {
        tenantId: tenantBId,
        storeId: storeB.id,
        name: 'Cuci B',
        unit: 'kg',
        unitCode: 'PER_KG',
        price: 8000,
        regularPrice: 8000,
      },
    });

    // 7. Create Orders for A & B
    const ordA = await prisma.order.create({
      data: {
        tenantId: tenantAId,
        storeId: storeA.id,
        customerId: customerAId,
        invoiceCode: 'INV-TEST-A-001',
        totalAmount: 14000,
        status: 'RECEIVED',
        items: {
          create: {
            tenantId: tenantAId,
            serviceId: servA.id,
            serviceName: 'Cuci A',
            quantity: 2,
            price: 7000,
            subtotal: 14000,
          },
        },
      },
    });
    orderAId = ordA.id;

    const ordB = await prisma.order.create({
      data: {
        tenantId: tenantBId,
        storeId: storeB.id,
        customerId: customerBId,
        invoiceCode: 'INV-TEST-B-001',
        totalAmount: 16000,
        status: 'RECEIVED',
        items: {
          create: {
            tenantId: tenantBId,
            serviceId: servB.id,
            serviceName: 'Cuci B',
            quantity: 2,
            price: 8000,
            subtotal: 16000,
          },
        },
      },
    });
    orderBId = ordB.id;
  });

  await t.test('Test 1: Scoped client Tenant A cannot view Tenant B customers in findMany', async () => {
    const prismaA = getTenantPrisma(tenantAId);
    const customers = await prismaA.customer.findMany();
    const customerIds = customers.map((c) => c.id);

    assert.ok(customerIds.includes(customerAId), 'Tenant A must see Customer A');
    assert.ok(!customerIds.includes(customerBId), 'Tenant A MUST NOT see Customer B');
  });

  await t.test('Test 2: Scoped client Tenant A guessing Customer B ID returns null', async () => {
    const prismaA = getTenantPrisma(tenantAId);
    const customer = await prismaA.customer.findUnique({
      where: { id: customerBId },
    });
    assert.equal(customer, null, 'Querying Tenant B Customer ID by Tenant A must return null');
  });

  await t.test('Test 3: Scoped client Tenant A cannot update Tenant B customer', async () => {
    const prismaA = getTenantPrisma(tenantAId);
    await assert.rejects(
      async () => {
        await prismaA.customer.update({
          where: { id: customerBId },
          data: { name: 'Hacked Name' },
        });
      },
      /bukan milik tenant Anda/,
      'Updating another tenant customer must be rejected',
    );

    // Verify Customer B data was NOT mutated
    const realCustomerB = await prisma.customer.findUnique({ where: { id: customerBId } });
    assert.equal(realCustomerB?.name, 'Pelanggan Rahasia B');
  });

  await t.test('Test 4: Scoped client Tenant A cannot delete Tenant B customer', async () => {
    const prismaA = getTenantPrisma(tenantAId);
    await assert.rejects(
      async () => {
        await prismaA.customer.delete({
          where: { id: customerBId },
        });
      },
      /bukan milik tenant Anda/,
      'Deleting another tenant customer must be rejected',
    );
  });

  await t.test('Test 5: Scoped client Tenant A cannot view Tenant B orders in findMany', async () => {
    const prismaA = getTenantPrisma(tenantAId);
    const orders = await prismaA.order.findMany();
    const orderIds = orders.map((o) => o.id);

    assert.ok(orderIds.includes(orderAId), 'Tenant A must see Order A');
    assert.ok(!orderIds.includes(orderBId), 'Tenant A MUST NOT see Order B');
  });

  await t.test('Test 6: Scoped client Tenant A guessing Order B ID returns null', async () => {
    const prismaA = getTenantPrisma(tenantAId);
    const order = await prismaA.order.findUnique({
      where: { id: orderBId },
    });
    assert.equal(order, null, 'Querying Tenant B Order ID by Tenant A must return null');
  });

  await t.test('Test 7: Scoped client Tenant A cannot update Tenant B order', async () => {
    const prismaA = getTenantPrisma(tenantAId);
    await assert.rejects(
      async () => {
        await prismaA.order.update({
          where: { id: orderBId },
          data: { status: 'CANCELLED' },
        });
      },
      /bukan milik tenant Anda/,
      'Updating another tenant order must be rejected',
    );
  });

  await t.test('Test 8: Scoped client Tenant A cannot delete Tenant B order', async () => {
    const prismaA = getTenantPrisma(tenantAId);
    await assert.rejects(
      async () => {
        await prismaA.order.delete({
          where: { id: orderBId },
        });
      },
      /bukan milik tenant Anda/,
      'Deleting another tenant order must be rejected',
    );
  });

  await t.test('Test 9: Cross-tenant Phone Numbers can duplicate without collision', async () => {
    const duplicatePhone = '081999999999';

    const custA = await prisma.customer.create({
      data: {
        tenantId: tenantAId,
        name: 'Shared Phone User (Tenant A)',
        phone: duplicatePhone,
      },
    });

    const custB = await prisma.customer.create({
      data: {
        tenantId: tenantBId,
        name: 'Shared Phone User (Tenant B)',
        phone: duplicatePhone,
      },
    });

    assert.ok(custA.id && custB.id);
    assert.notEqual(custA.id, custB.id);

    // Same tenant cannot duplicate the same phone
    await assert.rejects(
      async () => {
        await prisma.customer.create({
          data: {
            tenantId: tenantAId,
            name: 'Duplicate in same tenant',
            phone: duplicatePhone,
          },
        });
      },
      /Unique constraint failed/,
      'Phone must be unique per-tenant',
    );

    // Clean up test duplicates
    await prisma.customer.deleteMany({
      where: { id: { in: [custA.id, custB.id] } },
    });
  });

  await t.test('Test 10: Entitlement & Feature Flag Evaluation (Spec 3B)', async () => {
    invalidateTenantEntitlementCache();

    // 1. Basic Plan vs Pro Plan toggle feature
    const canTenantAViewProfitLoss = await canUseFeature(tenantAId, 'report.profit_loss');
    assert.equal(canTenantAViewProfitLoss, false, 'Tenant A (Basic) should not have profit_loss');

    const canTenantBViewProfitLoss = await canUseFeature(tenantBId, 'report.profit_loss');
    assert.equal(canTenantBViewProfitLoss, true, 'Tenant B (Pro) should have profit_loss');

    // 2. Quota check (-1 is unlimited)
    const limitA = await getFeatureLimit(tenantAId, 'order.monthly_limit');
    assert.equal(limitA, 100, 'Tenant A monthly limit should be 100');

    const limitB = await getFeatureLimit(tenantBId, 'order.monthly_limit');
    assert.equal(limitB, UNLIMITED_QUOTA, 'Tenant B monthly limit should be -1 (unlimited)');

    // 3. Tenant Override takes precedence over Plan
    await prisma.tenantFeatureOverride.upsert({
      where: { tenantId_featureCode: { tenantId: tenantAId, featureCode: 'report.profit_loss' } },
      update: { value: 'true', reason: 'Trial promotion override', expiresAt: null },
      create: {
        tenantId: tenantAId,
        featureCode: 'report.profit_loss',
        value: 'true',
        reason: 'Trial promotion override',
        expiresAt: null,
      },
    });
    invalidateTenantEntitlementCache(tenantAId);

    const overrideActive = await canUseFeature(tenantAId, 'report.profit_loss');
    assert.equal(overrideActive, true, 'Tenant A override should grant feature despite basic plan');

    // 4. Expired override is automatically ignored
    const pastDate = new Date(Date.now() - 3600 * 1000); // 1 hour ago
    await prisma.tenantFeatureOverride.update({
      where: { tenantId_featureCode: { tenantId: tenantAId, featureCode: 'report.profit_loss' } },
      data: { expiresAt: pastDate },
    });
    invalidateTenantEntitlementCache(tenantAId);

    const expiredIgnored = await canUseFeature(tenantAId, 'report.profit_loss');
    assert.equal(expiredIgnored, false, 'Expired override must be ignored and fallback to plan');

    // 5. Asia/Jakarta month range
    const range = getJakartaMonthRange();
    assert.ok(range.start instanceof Date);
    assert.ok(range.end instanceof Date);
    assert.ok(range.start < range.end);
    // Start of month in UTC should be 17:00:00 of previous day (UTC+7 to UTC is -7h)
    assert.equal(range.start.getUTCHours(), 17);
  });

  await t.test('Teardown: Clean up test fixtures', async () => {
    // Delete in order of dependencies
    await prisma.tenantFeatureOverride.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });
    await prisma.orderItem.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });
    await prisma.order.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });
    await prisma.service.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });
    await prisma.customer.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: ['owner-a@test.com', 'owner-b@test.com'] } },
    });
    await prisma.store.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantAId, tenantBId] } },
    });
    await prisma.planFeature.deleteMany({
      where: { planId: { in: [planBasicId, planProId] } },
    });
    await prisma.subscriptionPlan.deleteMany({
      where: { id: { in: [planBasicId, planProId] } },
    });
    invalidateTenantEntitlementCache();
  });
});
