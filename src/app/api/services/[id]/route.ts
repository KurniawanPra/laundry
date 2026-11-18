import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { errorResponse, parseJsonBody, requireApiUser, ApiError } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { serviceInputSchema } from '@/lib/laundry-validation';

const unitLabels = { PER_KG: 'kg', PER_PCS: 'pcs', PER_M2: 'm²' } as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(['OWNER']);
  if (auth.response) return auth.response;
  const parsed = await parseJsonBody(request, serviceInputSchema);
  if (parsed.response) return parsed.response;
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID layanan tidak valid.' }, { status: 400 });
  }
  const data = parsed.data;

  try {
    const service = await prisma.$transaction(async (transaction) => {
      const serviceWhere: Prisma.ServiceWhereInput = { id };
      if (auth.user.role !== 'SUPER_OWNER' || auth.user.tenantId) {
        serviceWhere.tenantId = auth.user.tenantId ?? -1;
      }
      const existing = await transaction.service.findFirst({ where: serviceWhere });
      if (!existing) throw new ApiError('Layanan tidak ditemukan.', 404);
      await transaction.service.update({
        where: { id },
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
      await transaction.serviceWorkflowStage.deleteMany({ where: { serviceId: id } });
      await transaction.serviceWorkflowStage.createMany({
        data: data.stages.map((stage, index) => ({
          serviceId: id,
          stage,
          position: index + 1,
        })),
      });
      return transaction.service.findUniqueOrThrow({
        where: { id },
        include: { stages: { orderBy: { position: 'asc' } } },
      });
    });
    return NextResponse.json(service);
  } catch (error) {
    return errorResponse(error, 'Gagal memperbarui layanan.');
  }
}
