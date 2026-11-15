import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { ApiError, errorResponse, parseJsonBody, requireApiUser } from '@/lib/api-utils';
import {
  getNextOrderStatus,
  getUndoStatus,
  getPaymentStatus,
  getRemainingBalance,
  isProductionStage,
  isValidStatusTransition,
  validateHandover,
} from '@/lib/laundry-domain';
import type { OrderStatus } from '@/lib/laundry-domain';
import { prisma } from '@/lib/prisma';
import { updateOrderSchema } from '@/lib/laundry-validation';

const orderInclude = Prisma.validator<Prisma.OrderInclude>()({
  customer: { select: { id: true, name: true, phone: true, address: true } },
  createdBy: { select: { id: true, name: true, role: true } },
  items: { include: { service: true } },
  payments: {
    include: { staff: { select: { id: true, name: true } } },
    orderBy: { paidAt: 'asc' },
  },
  statusLogs: {
    include: { staff: { select: { id: true, name: true } } },
    orderBy: [{ changedAt: 'asc' }, { id: 'asc' }],
  },
  complaints: {
    include: { handledBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  },
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID pesanan tidak valid.' }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id }, include: orderInclude });
  if (!order) return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });
  return NextResponse.json(order);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const parsed = await parseJsonBody(request, updateOrderSchema);
  if (parsed.response) return parsed.response;
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID pesanan tidak valid.' }, { status: 400 });
  }
  const input = parsed.data;

  try {
    const updated = await prisma.$transaction(async (transaction) => {
      const order = await transaction.order.findUnique({
        where: { id },
        include: {
          items: { select: { workflowStages: true } },
          payments: { select: { amount: true } },
        },
      });
      if (!order) throw new ApiError('Pesanan tidak ditemukan.', 404);
      if (input.undoStatusLogId !== undefined) {
        const logs = await transaction.orderStatusLog.findMany({
          where: { orderId: id },
          orderBy: [{ changedAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: { id: true, fromStatus: true, toStatus: true, isUndo: true, staffId: true, changedAt: true },
        });
        const undo = getUndoStatus({
          logs,
          currentStatus: order.status,
          actorId: auth.user.id,
          now: new Date(),
        });
        if (!undo || undo.logId !== input.undoStatusLogId) {
          throw new ApiError('Waktu urungkan sudah lewat atau status pesanan sudah berubah.', 409);
        }
        if (auth.user.role === 'WASHER' &&
          !['WASHING', 'DRYING', 'IRONING', 'PACKAGED'].includes(order.status)) {
          throw new ApiError('Petugas cuci hanya dapat mengurungkan status produksi.', 403);
        }
        if (auth.user.role === 'CASHIER' && !['QUEUED', 'READY'].includes(order.status)) {
          throw new ApiError('Kasir tidak memiliki izin mengurungkan status ini.', 403);
        }
        const result = await transaction.order.updateMany({
          where: { id, status: order.status },
          data: { status: undo.previousStatus },
        });
        if (result.count !== 1) {
          throw new ApiError('Pesanan berubah di perangkat lain. Muat ulang lalu coba lagi.', 409);
        }
        await transaction.orderStatusLog.create({
          data: {
            orderId: id,
            fromStatus: order.status,
            toStatus: undo.previousStatus,
            isUndo: true,
            staffId: auth.user.id,
          },
        });
        return transaction.order.findUniqueOrThrow({ where: { id }, include: orderInclude });
      }

      const paidAmount = order.payments.reduce((sum, payment) => sum + payment.amount, 0);
      let paymentToAdd = input.payment;

      if (input.paymentStatus === 'PAID') {
        const remaining = getRemainingBalance(order.totalAmount, paidAmount);
        if (remaining > 0 && !paymentToAdd) {
          paymentToAdd = {
            amount: remaining,
            method: input.paymentMethod ?? 'CASH',
          };
        }
      } else if (input.paymentStatus === 'PARTIAL') {
        throw new ApiError('Status DP harus dibuat melalui riwayat pembayaran.', 400);
      } else if (input.paymentStatus === 'UNPAID' && paidAmount > 0) {
        throw new ApiError('Pembayaran yang sudah dicatat tidak dapat dihapus.', 409);
      }

      if (paymentToAdd && !['OWNER', 'CASHIER'].includes(auth.user.role)) {
        throw new ApiError('Petugas cuci tidak dapat menerima pembayaran.', 403);
      }
      let nextPaidAmount = paidAmount;
      if (paymentToAdd) {
        const remaining = getRemainingBalance(order.totalAmount, paidAmount);
        if (paymentToAdd.amount > remaining) {
          throw new ApiError('Pembayaran melebihi sisa tagihan.', 400);
        }
        await transaction.payment.create({
          data: {
            orderId: id,
            staffId: auth.user.id,
            amount: paymentToAdd.amount,
            method: paymentToAdd.method,
          },
        });
        nextPaidAmount += paymentToAdd.amount;
        await transaction.order.update({
          where: { id },
          data: {
            paymentStatus: getPaymentStatus(order.totalAmount, nextPaidAmount),
            paymentMethod: paymentToAdd.method,
          },
        });
      }

      if (input.status) {
        const nextStatus: OrderStatus = input.status;
        const stages = [...new Set(order.items.flatMap((item) =>
          item.workflowStages.split(',').filter(isProductionStage),
        ))];
        if (!isValidStatusTransition(order.status, nextStatus, stages)) {
          const expected = getNextOrderStatus(order.status, stages);
          throw new ApiError(
            expected
              ? `Transisi tidak valid. Tahap berikutnya adalah ${expected}.`
              : 'Status pesanan ini tidak dapat diubah.',
            409,
          );
        }

        if (auth.user.role === 'WASHER' &&
          !['WASHING', 'DRYING', 'IRONING', 'PACKAGED'].includes(nextStatus)) {
          throw new ApiError('Petugas cuci hanya dapat mengubah status produksi.', 403);
        }
        if (auth.user.role === 'CASHIER' &&
          !['QUEUED', 'READY', 'COMPLETED'].includes(nextStatus)) {
          throw new ApiError('Kasir tidak memiliki izin untuk status produksi ini.', 403);
        }
        if (nextStatus === 'CANCELLED') {
          if (auth.user.role !== 'OWNER') {
            throw new ApiError('Hanya Pemilik yang dapat membatalkan pesanan.', 403);
          }
          if (!input.cancellationReason) {
            throw new ApiError('Alasan pembatalan wajib diisi.', 400);
          }
        }
        if (nextStatus === 'PACKAGED' || nextStatus === 'READY') {
          if (!(input.rackLocation ?? order.rackLocation)?.trim()) {
            throw new ApiError('Lokasi rak wajib diisi saat cucian dikemas atau siap diambil.', 400);
          }
        }
        if (nextStatus === 'COMPLETED') {
          if (!['OWNER', 'CASHIER'].includes(auth.user.role)) {
            throw new ApiError('Petugas cuci tidak dapat melakukan serah-terima.', 403);
          }
          validateHandover({
            invoiceCode: order.invoiceCode,
            totalAmount: order.totalAmount,
            paidAmount: nextPaidAmount,
            verifiedInvoiceCode: input.verifiedInvoiceCode,
            pickedUpBy: input.pickedUpBy,
            allowUnpaid: input.allowUnpaid,
            role: auth.user.role,
          });
        }

        const result = await transaction.order.updateMany({
          where: { id, status: order.status },
          data: {
            status: nextStatus,
            ...(input.rackLocation !== undefined && { rackLocation: input.rackLocation }),
            ...(input.cancellationReason && { cancellationReason: input.cancellationReason }),
            ...(nextStatus === 'COMPLETED' && input.pickedUpBy && { pickedUpBy: input.pickedUpBy }),
          },
        });
        if (result.count !== 1) {
          throw new ApiError('Pesanan berubah di perangkat lain. Muat ulang lalu coba lagi.', 409);
        }
        await transaction.orderStatusLog.create({
          data: {
            orderId: id,
            fromStatus: order.status,
            toStatus: nextStatus,
            staffId: auth.user.id,
          },
        });
      } else if (input.rackLocation !== undefined) {
        if (!['OWNER', 'CASHIER'].includes(auth.user.role)) {
          throw new ApiError('Anda tidak memiliki izin mengubah lokasi rak.', 403);
        }
        if (input.rackLocation === null && ['PACKAGED', 'READY'].includes(order.status)) {
          throw new ApiError('Lokasi rak tidak boleh dikosongkan selama cucian masih dalam proses serah-terima.', 400);
        }
        await transaction.order.update({ where: { id }, data: { rackLocation: input.rackLocation } });
      }

      return transaction.order.findUniqueOrThrow({ where: { id }, include: orderInclude });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json(updated);
  } catch (error) {
    return errorResponse(error, 'Gagal memperbarui pesanan.');
  }
}
