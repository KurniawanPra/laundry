import { NextResponse } from 'next/server';
import { errorResponse, parseJsonBody, requireApiUser } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { serviceInputSchema } from '@/lib/laundry-validation';

const unitLabels = { PER_KG: 'kg', PER_PCS: 'pcs', PER_M2: 'm²' } as const;

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const services = await prisma.service.findMany({
    where: auth.user.role === 'OWNER' ? undefined : { isActive: true },
    include: { stages: { orderBy: { position: 'asc' } } },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(services);
}

export async function POST(request: Request) {
  const auth = await requireApiUser(['OWNER']);
  if (auth.response) return auth.response;
  const parsed = await parseJsonBody(request, serviceInputSchema);
  if (parsed.response) return parsed.response;
  const data = parsed.data;

  try {
    const service = await prisma.$transaction(async (transaction) => {
      const created = await transaction.service.create({
        data: {
          name: data.name,
          unit: unitLabels[data.unitCode],
          unitCode: data.unitCode,
          price: data.regularPrice,
          regularPrice: data.regularPrice,
          expressPrice: data.expressPrice ?? Math.round(data.regularPrice * 1.5),
          durationHrs: data.durationHrs,
          expressDurationHrs: data.expressDurationHrs ?? Math.max(1, Math.round(data.durationHrs / 2)),
          isActive: data.isActive,
        },
      });
      await transaction.serviceWorkflowStage.createMany({
        data: data.stages.map((stage, index) => ({
          serviceId: created.id,
          stage,
          position: index + 1,
        })),
      });
      return transaction.service.findUniqueOrThrow({
        where: { id: created.id },
        include: { stages: { orderBy: { position: 'asc' } } },
      });
    });
    return NextResponse.json(service, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Gagal menambahkan layanan.');
  }
}
