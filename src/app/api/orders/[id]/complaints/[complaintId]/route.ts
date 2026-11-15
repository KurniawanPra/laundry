import { NextResponse } from 'next/server';
import { ApiError, errorResponse, parseJsonBody, requireApiUser } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { complaintUpdateSchema } from '@/lib/laundry-validation';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; complaintId: string }> },
) {
  const auth = await requireApiUser(['OWNER', 'CASHIER']);
  if (auth.response) return auth.response;
  const parsed = await parseJsonBody(request, complaintUpdateSchema);
  if (parsed.response) return parsed.response;
  const { id: rawOrderId, complaintId: rawComplaintId } = await params;
  const orderId = Number(rawOrderId);
  const complaintId = Number(rawComplaintId);
  if (![orderId, complaintId].every((id) => Number.isSafeInteger(id) && id > 0)) {
    return NextResponse.json({ error: 'ID komplain tidak valid.' }, { status: 400 });
  }

  try {
    const existing = await prisma.complaint.findFirst({ where: { id: complaintId, orderId } });
    if (!existing) throw new ApiError('Komplain tidak ditemukan.', 404);
    const complaint = await prisma.complaint.update({
      where: { id: complaintId },
      data: {
        status: parsed.data.status,
        handledById: parsed.data.status === 'RESOLVED' ? auth.user.id : null,
      },
      include: { handledBy: { select: { id: true, name: true } } },
    });
    return NextResponse.json(complaint);
  } catch (error) {
    return errorResponse(error, 'Gagal memperbarui komplain.');
  }
}
