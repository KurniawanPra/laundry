import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password';

const prisma = new PrismaClient();

async function main() {
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
      where: { name: service.name },
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
    { name: 'Reguler', priceMultiplier: 1, durationMultiplier: 1 },
    { name: 'Express', priceMultiplier: 1.5, durationMultiplier: 0.5 },
  ]) {
    await prisma.laundrySpeed.upsert({
      where: { name: speed.name },
      update: {},
      create: speed,
    });
  }

  await prisma.appSetting.upsert({
    where: { key: 'uncollectedReadyDays' },
    update: {},
    create: { key: 'uncollectedReadyDays', value: '7' },
  });

  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const ownerPassword = process.env.OWNER_PASSWORD;
  if (ownerEmail || ownerPassword) {
    if (!ownerEmail || !ownerPassword || ownerPassword.length < 12) {
      throw new Error('OWNER_EMAIL dan OWNER_PASSWORD minimal 12 karakter wajib disetel bersama.');
    }
    const existingOwner = await prisma.user.findUnique({ where: { email: ownerEmail } });
    if (!existingOwner) {
      await prisma.user.create({
        data: {
          name: process.env.OWNER_NAME?.trim() || 'Pemilik',
          email: ownerEmail,
          passwordHash: await hashPassword(ownerPassword),
          role: 'OWNER',
        },
      });
    }
  } else {
    console.warn('OWNER_EMAIL dan OWNER_PASSWORD belum disetel; akun pemilik tidak dibuat.');
  }

  console.log('Data layanan laundry berhasil diisi.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
