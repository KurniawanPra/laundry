import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password';

const prisma = new PrismaClient();

async function main() {
  // 0. Seed Default Tenant
  const defaultTenant = await prisma.tenant.upsert({
    where: { slug: 'laundry-utama' },
    update: {},
    create: {
      name: 'Laundry Utama',
      slug: 'laundry-utama',
      status: 'ACTIVE',
    },
  });

  // 1. Seed Toko / Cabang Awal
  const mainStore = await prisma.store.upsert({
    where: { tenantId_code: { tenantId: defaultTenant.id, code: 'PST' } },
    update: {},
    create: {
      tenantId: defaultTenant.id,
      code: 'PST',
      name: 'Laundry Cabang Pusat',
      address: 'Jl. Jenderal Sudirman No. 1, Jakarta Pusat',
      phone: '081211112222',
      isActive: true,
    },
  });

  const tebetStore = await prisma.store.upsert({
    where: { tenantId_code: { tenantId: defaultTenant.id, code: 'TBT' } },
    update: {},
    create: {
      tenantId: defaultTenant.id,
      code: 'TBT',
      name: 'Laundry Cabang Tebet',
      address: 'Jl. Tebet Raya No. 45, Jakarta Selatan',
      phone: '081233334444',
      isActive: true,
    },
  });

  console.log(`Toko terdaftar: ${mainStore.name} (${mainStore.code}) & ${tebetStore.name} (${tebetStore.code})`);

  // 2. Hubungkan data eksisting tanpa toko ke Toko Pusat
  await prisma.service.updateMany({
    where: { storeId: null },
    data: { storeId: mainStore.id },
  });
  await prisma.laundrySpeed.updateMany({
    where: { storeId: null },
    data: { storeId: mainStore.id },
  });
  await prisma.customer.updateMany({
    where: { storeId: null },
    data: { storeId: mainStore.id },
  });
  await prisma.order.updateMany({
    where: { storeId: null },
    data: { storeId: mainStore.id },
  });
  await prisma.cashClosure.updateMany({
    where: { storeId: null },
    data: { storeId: mainStore.id },
  });

  // 3. Seed Layanan Bawaan untuk Toko Pusat
  const services = [
    {
      name: 'Cuci Komplit Reguler',
      unit: 'kg',
      unitCode: 'PER_KG' as const,
      regularPrice: 7000,
      expressPrice: 10000,
      durationHrs: 48,
      expressDurationHrs: 24,
      stages: ['WASHING', 'DRYING', 'IRONING'] as const,
    },
    {
      name: 'Cuci Komplit Kilat (1 Hari)',
      unit: 'kg',
      unitCode: 'PER_KG' as const,
      regularPrice: 12000,
      expressPrice: 15000,
      durationHrs: 24,
      expressDurationHrs: 12,
      stages: ['WASHING', 'DRYING', 'IRONING'] as const,
    },
    {
      name: 'Cuci Kering Lipat',
      unit: 'kg',
      unitCode: 'PER_KG' as const,
      regularPrice: 5000,
      expressPrice: 7500,
      durationHrs: 24,
      expressDurationHrs: 12,
      stages: ['WASHING', 'DRYING'] as const,
    },
    {
      name: 'Setrika Saja',
      unit: 'kg',
      unitCode: 'PER_KG' as const,
      regularPrice: 5000,
      expressPrice: 7500,
      durationHrs: 24,
      expressDurationHrs: 12,
      stages: ['IRONING'] as const,
    },
    {
      name: 'Bed Cover Besar',
      unit: 'pcs',
      unitCode: 'PER_PCS' as const,
      regularPrice: 25000,
      expressPrice: 37500,
      durationHrs: 72,
      expressDurationHrs: 36,
      stages: ['WASHING', 'DRYING', 'IRONING'] as const,
    },
    {
      name: 'Selimut / Sprei Set',
      unit: 'pcs',
      unitCode: 'PER_PCS' as const,
      regularPrice: 15000,
      expressPrice: 22500,
      durationHrs: 48,
      expressDurationHrs: 24,
      stages: ['WASHING', 'DRYING', 'IRONING'] as const,
    },
    {
      name: 'Karpet',
      unit: 'm²',
      unitCode: 'PER_M2' as const,
      regularPrice: 20000,
      expressPrice: 30000,
      durationHrs: 72,
      expressDurationHrs: 36,
      stages: ['WASHING', 'DRYING'] as const,
    },
  ];

  for (const service of services) {
    const existing = await prisma.service.findFirst({
      where: { name: service.name, storeId: mainStore.id },
    });
    if (existing) continue;

    const data = {
      name: service.name,
      unit: service.unit,
      unitCode: service.unitCode,
      price: service.regularPrice,
      regularPrice: service.regularPrice,
      expressPrice: service.expressPrice,
      durationHrs: service.durationHrs,
      expressDurationHrs: service.expressDurationHrs,
      storeId: mainStore.id,
    };
    const savedService = await prisma.service.create({ data });

    await prisma.serviceWorkflowStage.deleteMany({ where: { serviceId: savedService.id } });
    await prisma.serviceWorkflowStage.createMany({
      data: service.stages.map((stage, index) => ({
        serviceId: savedService.id,
        stage,
        position: index + 1,
      })),
    });
  }

  for (const speed of [
    { name: 'Reguler', priceMultiplier: 1, durationMultiplier: 1, storeId: mainStore.id },
    { name: 'Express', priceMultiplier: 1.5, durationMultiplier: 0.5, storeId: mainStore.id },
  ]) {
    await prisma.laundrySpeed.upsert({
      where: { tenantId_name: { tenantId: defaultTenant.id, name: speed.name } },
      update: { storeId: mainStore.id, tenantId: defaultTenant.id },
      create: { ...speed, tenantId: defaultTenant.id },
    });
  }

  await prisma.appSetting.upsert({
    where: { tenantId_key: { tenantId: defaultTenant.id, key: 'uncollectedReadyDays' } },
    update: {},
    create: { tenantId: defaultTenant.id, key: 'uncollectedReadyDays', value: '7' },
  });

  // 4. Seed Akun SUPER_OWNER (Admin Global Multi-Toko)
  const superOwnerEmail = process.env.SUPER_OWNER_EMAIL?.trim().toLowerCase() || 'superowner@admin.com';
  const superOwnerPassword = process.env.SUPER_OWNER_PASSWORD || 'admin123';
  const existingSuperOwner = await prisma.user.findUnique({ where: { email: superOwnerEmail } });

  if (existingSuperOwner) {
    await prisma.user.update({
      where: { id: existingSuperOwner.id },
      data: {
        name: 'Super Owner (Direksi / Multi-Toko)',
        role: 'SUPER_OWNER',
        passwordHash: await hashPassword(superOwnerPassword),
        isActive: true,
      },
    });
    console.log(`Akun SUPER_OWNER (${superOwnerEmail}) disinkronkan.`);
  } else {
    await prisma.user.create({
      data: {
        name: 'Super Owner (Direksi / Multi-Toko)',
        email: superOwnerEmail,
        passwordHash: await hashPassword(superOwnerPassword),
        role: 'SUPER_OWNER',
      },
    });
    console.log(`Akun SUPER_OWNER (${superOwnerEmail}) berhasil dibuat.`);
  }

  // 5. Seed Akun OWNER (Cabang Pusat)
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase() || 'admin@admin.com';
  const ownerPassword = process.env.OWNER_PASSWORD || 'admin123';
  const existingOwner = await prisma.user.findUnique({ where: { email: ownerEmail } });

  let ownerUser;
  if (existingOwner) {
    ownerUser = await prisma.user.update({
      where: { id: existingOwner.id },
      data: {
        name: process.env.OWNER_NAME?.trim() || existingOwner.name,
        role: 'OWNER',
        tenantId: defaultTenant.id,
        passwordHash: await hashPassword(ownerPassword),
        isActive: true,
      },
    });
    console.log(`Akun OWNER (${ownerEmail}) disinkronkan.`);
  } else {
    ownerUser = await prisma.user.create({
      data: {
        name: process.env.OWNER_NAME?.trim() || 'Pemilik Cabang Pusat',
        email: ownerEmail,
        tenantId: defaultTenant.id,
        passwordHash: await hashPassword(ownerPassword),
        role: 'OWNER',
      },
    });
    console.log(`Akun OWNER (${ownerEmail}) berhasil dibuat.`);
  }

  // Kaitkan owner ke Cabang Pusat
  await prisma.store.update({
    where: { id: mainStore.id },
    data: { ownerId: ownerUser.id },
  });

  await prisma.storeUser.upsert({
    where: { userId_storeId: { userId: ownerUser.id, storeId: mainStore.id } },
    update: { role: 'OWNER' },
    create: { userId: ownerUser.id, storeId: mainStore.id, role: 'OWNER' },
  });

  // 6. Seed Akun Petugas (Washer / Kasir)
  const staffEmail = 'petugas1@gmail.com';
  const staffPassword = 'admin123';
  const existingStaff = await prisma.user.findUnique({ where: { email: staffEmail } });

  let staffUser;
  if (existingStaff) {
    staffUser = await prisma.user.update({
      where: { id: existingStaff.id },
      data: {
        name: 'Petugas 1',
        role: 'WASHER',
        tenantId: defaultTenant.id,
        passwordHash: await hashPassword(staffPassword),
        isActive: true,
      },
    });
    console.log(`Akun Petugas (${staffEmail}) disinkronkan.`);
  } else {
    staffUser = await prisma.user.create({
      data: {
        name: 'Petugas 1',
        email: staffEmail,
        tenantId: defaultTenant.id,
        passwordHash: await hashPassword(staffPassword),
        role: 'WASHER',
      },
    });
    console.log(`Akun Petugas (${staffEmail}) berhasil dibuat.`);
  }

  // Kaitkan petugas ke Cabang Pusat
  await prisma.storeUser.upsert({
    where: { userId_storeId: { userId: staffUser.id, storeId: mainStore.id } },
    update: { role: 'WASHER' },
    create: { userId: staffUser.id, storeId: mainStore.id, role: 'WASHER' },
  });

  console.log('Seed data multi-toko berhasil dijalankan!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
