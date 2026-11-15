import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateOrderTotals,
  getNextOrderStatus,
  getSpeedPricing,
  getUndoStatus,
  isValidStatusTransition,
  validateHandover,
} from './laundry-domain';

test('transisi cucian mengikuti tahapan layanan dan tetap satu arah', () => {
  const stages = ['WASHING', 'IRONING'] as const;
  assert.equal(getNextOrderStatus('QUEUED', [...stages]), 'WASHING');
  assert.equal(getNextOrderStatus('WASHING', [...stages]), 'IRONING');
  assert.equal(getNextOrderStatus('IRONING', [...stages]), 'PACKAGED');
  assert.equal(getNextOrderStatus('QUEUED', []), 'PACKAGED');
  assert.equal(isValidStatusTransition('WASHING', 'IRONING', [...stages]), true);
  assert.equal(isValidStatusTransition('WASHING', 'QUEUED', [...stages]), false);
  assert.equal(isValidStatusTransition('COMPLETED', 'CANCELLED', [...stages]), false);
});

test('kalkulasi multi-item menggunakan tarif dan durasi express', () => {
  const totals = calculateOrderTotals([
    {
      quantity: 2.5,
      rateType: 'REGULAR',
      regularPrice: 8_000,
      expressPrice: 12_000,
      regularDurationHrs: 48,
      expressDurationHrs: 24,
    },
    {
      quantity: 3,
      rateType: 'EXPRESS',
      regularPrice: 10_000,
      expressPrice: 15_000,
      regularDurationHrs: 48,
      expressDurationHrs: 12,
    },
  ]);
  assert.deepEqual(totals.lines.map((line) => [line.unitPrice, line.durationHrs, line.subtotal]), [
    [8_000, 48, 20_000],
    [15_000, 12, 45_000],
  ]);
  assert.equal(totals.totalAmount, 65_000);
  assert.equal(totals.durationHrs, 48);
  assert.throws(() => calculateOrderTotals([]), /minimal satu layanan/);
});

test('kecepatan dinamis mengalikan tarif dasar dan durasi layanan', () => {
  assert.deepEqual(getSpeedPricing({
    basePrice: 7_000,
    baseDurationHrs: 48,
    priceMultiplier: 1.75,
    durationMultiplier: 0.25,
  }), { unitPrice: 12_250, durationHrs: 12 });

  const totals = calculateOrderTotals([{
    quantity: 2,
    rateType: 'REGULAR',
    regularPrice: 7_000,
    expressPrice: 10_000,
    regularDurationHrs: 48,
    expressDurationHrs: 24,
    speedPrice: 12_250,
    speedDurationHrs: 12,
  }]);
  assert.deepEqual(totals.lines, [{ unitPrice: 12_250, durationHrs: 12, subtotal: 24_500 }]);
  assert.equal(totals.durationHrs, 12);
});

test('serah-terima mewajibkan verifikasi dan pembayaran lunas kecuali disetujui pemilik', () => {
  assert.doesNotThrow(() => validateHandover({
    invoiceCode: 'INV-001',
    totalAmount: 50_000,
    paidAmount: 50_000,
    verifiedInvoiceCode: 'inv-001',
    role: 'CASHIER',
  }));
  assert.throws(() => validateHandover({
    invoiceCode: 'INV-001',
    totalAmount: 50_000,
    paidAmount: 50_000,
    role: 'CASHIER',
  }), /Verifikasi kode invoice/);
  assert.throws(() => validateHandover({
    invoiceCode: 'INV-001',
    totalAmount: 50_000,
    paidAmount: 20_000,
    pickedUpBy: 'Budi',
    role: 'CASHIER',
  }), /belum lunas/);
  assert.doesNotThrow(() => validateHandover({
    invoiceCode: 'INV-001',
    totalAmount: 50_000,
    paidAmount: 20_000,
    pickedUpBy: 'Budi',
    allowUnpaid: true,
    role: 'OWNER',
  }));
});

test('status hanya dapat diurungkan oleh petugas pembuat dalam delapan detik', () => {
  const now = new Date('2026-11-15T10:00:08.000Z');
  const log = {
    id: 21,
    fromStatus: 'QUEUED' as const,
    toStatus: 'WASHING' as const,
    isUndo: false,
    staffId: 7,
    changedAt: new Date('2026-11-15T10:00:00.000Z'),
  };
  assert.deepEqual(getUndoStatus({ logs: [log], currentStatus: 'WASHING', actorId: 7, now }), {
    logId: 21,
    previousStatus: 'QUEUED',
  });
  assert.equal(getUndoStatus({ logs: [log], currentStatus: 'WASHING', actorId: 8, now }), null);
  assert.equal(getUndoStatus({
    logs: [log],
    currentStatus: 'WASHING',
    actorId: 7,
    now: new Date(now.getTime() + 1),
  }), null);
  assert.equal(getUndoStatus({
    logs: [{ ...log, toStatus: 'COMPLETED' }],
    currentStatus: 'COMPLETED',
    actorId: 7,
    now,
  }), null);
  assert.equal(getUndoStatus({
    logs: [{ ...log, isUndo: true }],
    currentStatus: 'WASHING',
    actorId: 7,
    now,
  }), null);
});
