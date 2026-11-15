import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { ApiError, errorResponse, parseJsonBody, requireApiUser } from '@/lib/api-utils';
import { calculateOrderTotals, DomainError, getPaymentStatus, getSpeedPricing } from '@/lib/laundry-domain';
import { prisma } from '@/lib/prisma';
import { createOrderSchema } from '@/lib/laundry-validation';

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

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  try {
    const orders = await prisma.order.findMany({
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(orders);
  } catch (error) {
    return errorResponse(error, 'Gagal mengambil daftar pesanan.');
  }
}

export async function POST(request: Request) {
  const auth = await requireApiUser(['OWNER', 'CASHIER']);
  if (auth.response) return auth.response;
  const parsed = await parseJsonBody(request, createOrderSchema);
  if (parsed.response) return parsed.response;
  const input = parsed.data;
  const name = input.customer?.name ?? input.customerName;
  const phone = input.customer?.phone ?? input.customerPhone;
  if (!name || !phone) {
    return NextResponse.json({ error: 'Nama dan nomor telepon pelanggan wajib diisi.' }, { status: 400 });
  }

  try {
    const serviceIds = [...new Set(input.items.map((item) => item.serviceId))];
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds }, isActive: true },
      include: { stages: { orderBy: { position: 'asc' } } },
    });
    if (services.length !== serviceIds.length) {
      throw new DomainError('Satu atau beberapa layanan tidak ditemukan atau sudah nonaktif.');
    }

    const speedIds = [...new Set(input.items.flatMap((item) => item.speedId ? [item.speedId] : []))];
    const speeds = speedIds.length
      ? await prisma.laundrySpeed.findMany({ where: { id: { in: speedIds }, isActive: true } })
      : [];
    if (speeds.length !== speedIds.length) {
      throw new DomainError('Satu atau beberapa kecepatan tidak ditemukan atau sudah nonaktif.');
    }

    const serviceById = new Map(services.map((service) => [service.id, service]));
    const speedById = new Map(speeds.map((speed) => [speed.id, speed]));
    const lines = input.items.map((item) => {
      const service = serviceById.get(item.serviceId);
      if (!service) throw new DomainError('Layanan tidak ditemukan.');
      const speed = item.speedId ? speedById.get(item.speedId) : undefined;
      const speedPricing = speed
        ? getSpeedPricing({
          basePrice: service.regularPrice,
          baseDurationHrs: service.durationHrs,
          priceMultiplier: speed.priceMultiplier,
          durationMultiplier: speed.durationMultiplier,
        })
        : undefined;
      return {
        service,
        quantity: item.quantity,
        rateType: speed
          ? speed.name.toLowerCase() === 'express' ? 'EXPRESS' as const : 'REGULAR' as const
          : item.rateType,
        speedName: speed?.name ?? (item.rateType === 'EXPRESS' ? 'Express' : 'Reguler'),
        speedPrice: speedPricing?.unitPrice,
        speedDurationHrs: speedPricing?.durationHrs,
        regularPrice: service.regularPrice,
        expressPrice: service.expressPrice,
        regularDurationHrs: service.durationHrs,
        expressDurationHrs: service.expressDurationHrs,
      };
    });
    const totals = calculateOrderTotals(lines);
    const requestedInitialPayment = input.initialPayment?.amount ??
      (input.paymentStatus === 'PAID' ? totals.totalAmount : 0);
    if (requestedInitialPayment > totals.totalAmount) {
      throw new DomainError('Pembayaran awal tidak boleh melebihi total tagihan.');
    }

    const invoiceCode = `INV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const estimatedDone = new Date(Date.now() + totals.durationHrs * 60 * 60 * 1000);
    const created = await prisma.$transaction(async (transaction) => {
      const customer = await transaction.customer.upsert({
        where: { phone },
        update: { name },
        create: { name, phone },
      });
      const order = await transaction.order.create({
        data: {
          invoiceCode,
          customerId: customer.id,
          createdById: auth.user.id,
          status: 'RECEIVED',
          paymentStatus: 'UNPAID',
          totalAmount: totals.totalAmount,
          notes: input.notes || null,
          estimatedDone,
          items: {
            create: lines.map((line, index) => ({
              serviceId: line.service.id,
              serviceName: line.service.name,
              unitCode: line.service.unitCode,
              rateType: line.rateType,
              speedName: line.speedName,
              durationHrs: totals.lines[index].durationHrs,
              workflowStages: line.service.stages.map((stage) => stage.stage).join(','),
              quantity: line.quantity,
              price: totals.lines[index].unitPrice,
              subtotal: totals.lines[index].subtotal,
            })),
          },
        },
      });
      await transaction.orderStatusLog.create({
        data: { orderId: order.id, fromStatus: null, toStatus: 'RECEIVED', staffId: auth.user.id },
      });
      if (requestedInitialPayment > 0) {
        const method = input.initialPayment?.method ?? input.paymentMethod ?? 'CASH';
        await transaction.payment.create({
          data: {
            orderId: order.id,
            staffId: auth.user.id,
            amount: requestedInitialPayment,
            method,
          },
        });
        await transaction.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: getPaymentStatus(totals.totalAmount, requestedInitialPayment),
            paymentMethod: method,
          },
        });
      }
      return transaction.order.findUniqueOrThrow({
        where: { id: order.id },
        include: orderInclude,
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return errorResponse(new ApiError('Nomor invoice sudah digunakan. Silakan coba lagi.', 409), '');
    }
    return errorResponse(error, 'Gagal membuat transaksi.');
  }
}
