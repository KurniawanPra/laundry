export const orderStatuses = [
  'RECEIVED',
  'QUEUED',
  'WASHING',
  'DRYING',
  'IRONING',
  'PACKAGED',
  'READY',
  'COMPLETED',
  'CANCELLED',
] as const;

export type OrderStatus = (typeof orderStatuses)[number];
export type ProductionStage = 'WASHING' | 'DRYING' | 'IRONING';
export type UserRole = 'OWNER' | 'CASHIER' | 'WASHER';
export type RateType = 'REGULAR' | 'EXPRESS';
export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

const stageOrder: ProductionStage[] = ['WASHING', 'DRYING', 'IRONING'];

export function isProductionStage(value: string): value is ProductionStage {
  return stageOrder.some((stage) => stage === value);
}

export function getNextOrderStatus(
  current: OrderStatus,
  configuredStages: ProductionStage[],
): OrderStatus | null {
  if (current === 'RECEIVED') return 'QUEUED';
  if (current === 'QUEUED') {
    return stageOrder.find((stage) => configuredStages.includes(stage)) ?? 'PACKAGED';
  }
  const currentIndex = stageOrder.findIndex((stage) => stage === current);
  if (currentIndex >= 0) {
    return stageOrder.find(
      (stage, index) => index > currentIndex && configuredStages.includes(stage),
    ) ?? 'PACKAGED';
  }
  if (current === 'PACKAGED') return 'READY';
  if (current === 'READY') return 'COMPLETED';
  return null;
}

export function isValidStatusTransition(
  current: OrderStatus,
  next: OrderStatus,
  configuredStages: ProductionStage[],
): boolean {
  if (next === 'CANCELLED') {
    return current !== 'COMPLETED' && current !== 'CANCELLED';
  }
  return getNextOrderStatus(current, configuredStages) === next;
}

export function getUndoStatus(input: {
  logs: { id: number; fromStatus: OrderStatus | null; toStatus: OrderStatus; isUndo: boolean; staffId: number | null; changedAt: Date }[];
  currentStatus: OrderStatus;
  actorId: number;
  now: Date;
}): { logId: number; previousStatus: OrderStatus } | null {
  const latest = input.logs[0];
  if (
    !latest ||
    !latest.fromStatus ||
    latest.id <= 0 ||
    latest.isUndo ||
    latest.staffId !== input.actorId ||
    latest.toStatus !== input.currentStatus ||
    latest.toStatus === 'COMPLETED' ||
    latest.toStatus === 'CANCELLED' ||
    input.now.getTime() - latest.changedAt.getTime() < 0 ||
    input.now.getTime() - latest.changedAt.getTime() > 8_000
  ) return null;

  return { logId: latest.id, previousStatus: latest.fromStatus };
}

export type PricedOrderItem = {
  quantity: number;
  rateType: RateType;
  regularPrice: number;
  expressPrice: number;
  regularDurationHrs: number;
  expressDurationHrs: number;
  speedPrice?: number;
  speedDurationHrs?: number;
};

export function getSpeedPricing(input: {
  basePrice: number;
  baseDurationHrs: number;
  priceMultiplier: number;
  durationMultiplier: number;
}) {
  if (
    !Number.isInteger(input.basePrice) ||
    input.basePrice < 0 ||
    !Number.isInteger(input.baseDurationHrs) ||
    input.baseDurationHrs < 1 ||
    !Number.isFinite(input.priceMultiplier) ||
    input.priceMultiplier <= 0 ||
    !Number.isFinite(input.durationMultiplier) ||
    input.durationMultiplier <= 0
  ) {
    throw new DomainError('Tarif atau kecepatan layanan tidak valid.');
  }

  return {
    unitPrice: Math.round(input.basePrice * input.priceMultiplier),
    durationHrs: Math.max(1, Math.round(input.baseDurationHrs * input.durationMultiplier)),
  };
}

export function calculateOrderTotals(items: PricedOrderItem[]) {
  if (!items.length) throw new DomainError('Keranjang wajib berisi minimal satu layanan.');

  const lines = items.map((item) => {
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new DomainError('Jumlah layanan harus lebih besar dari nol.');
    }

    const unitPrice = item.speedPrice ??
      (item.rateType === 'EXPRESS' ? item.expressPrice : item.regularPrice);
    const durationHrs = item.speedDurationHrs ??
      (item.rateType === 'EXPRESS' ? item.expressDurationHrs : item.regularDurationHrs);
    if (!Number.isInteger(unitPrice) || unitPrice < 0 || durationHrs <= 0) {
      throw new DomainError('Tarif atau durasi layanan tidak valid.');
    }

    return {
      unitPrice,
      durationHrs,
      subtotal: Math.round(item.quantity * unitPrice),
    };
  });

  return {
    lines,
    totalAmount: lines.reduce((total, line) => total + line.subtotal, 0),
    durationHrs: Math.max(...lines.map((line) => line.durationHrs)),
  };
}

export function getPaymentStatus(totalAmount: number, paidAmount: number): PaymentStatus {
  if (paidAmount <= 0) return 'UNPAID';
  if (paidAmount < totalAmount) return 'PARTIAL';
  return 'PAID';
}

export function getRemainingBalance(totalAmount: number, paidAmount: number) {
  return Math.max(0, totalAmount - paidAmount);
}

export function validateHandover(input: {
  invoiceCode: string;
  totalAmount: number;
  paidAmount: number;
  verifiedInvoiceCode?: string;
  pickedUpBy?: string;
  allowUnpaid?: boolean;
  role: UserRole;
}) {
  const invoiceMatches = input.verifiedInvoiceCode?.trim().toUpperCase() ===
    input.invoiceCode.trim().toUpperCase();
  if (!invoiceMatches && !input.pickedUpBy?.trim()) {
    throw new DomainError('Verifikasi kode invoice atau isi nama pengambil.');
  }

  const remaining = getRemainingBalance(input.totalAmount, input.paidAmount);
  if (remaining > 0 && !(input.allowUnpaid === true && input.role === 'OWNER')) {
    throw new DomainError('Tagihan belum lunas. Hanya Pemilik yang dapat menyetujui serah-terima.');
  }
}
