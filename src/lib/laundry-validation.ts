import { z } from 'zod';
import { orderStatuses } from '@/lib/laundry-domain';

const productionStages = ['WASHING', 'DRYING', 'IRONING'] as const;
const paymentMethods = ['CASH', 'TRANSFER', 'QRIS'] as const;
const legacyPaymentMethod = z.preprocess(
  (value) => typeof value === 'string' ? value.trim().toUpperCase() : value,
  z.enum(paymentMethods),
);

const statusInput = z.enum([...orderStatuses, 'PENDING']).transform((status) =>
  status === 'PENDING' ? 'QUEUED' : status,
);

const customerName = z.string().trim().min(1, 'Nama pelanggan wajib diisi.').max(191);
const customerPhone = z.string()
  .trim()
  .min(8, 'Nomor telepon minimal 8 karakter.')
  .max(24, 'Nomor telepon maksimal 24 karakter.')
  .regex(/^[0-9+()\-\s]+$/, 'Nomor telepon hanya boleh berisi angka dan tanda +, -, atau kurung.');

const orderItemInput = z.object({
  serviceId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().finite().positive().max(10000),
  speedId: z.coerce.number().int().positive().optional(),
  rateType: z.enum(['REGULAR', 'EXPRESS']).default('REGULAR'),
});

export const createOrderSchema = z.object({
  customer: z.object({ name: customerName, phone: customerPhone }).optional(),
  customerName: customerName.optional(),
  customerPhone: customerPhone.optional(),
  items: z.array(orderItemInput).min(1, 'Keranjang wajib berisi minimal satu layanan.').max(50),
  initialPayment: z.object({
    amount: z.coerce.number().int().positive(),
    method: legacyPaymentMethod,
  }).optional(),
  paymentStatus: z.enum(['UNPAID', 'PAID']).optional(),
  paymentMethod: legacyPaymentMethod.optional(),
  notes: z.string().trim().max(5000).optional(),
  storeId: z.coerce.number().int().positive().optional(),
}).refine(
  (input) => Boolean(input.customer || (input.customerName && input.customerPhone)),
  { message: 'Nama dan nomor telepon pelanggan wajib diisi.', path: ['customer'] },
).refine(
  (input) => !(input.initialPayment && input.paymentStatus === 'PAID'),
  { message: 'Pilih pembayaran awal atau status lunas, bukan keduanya.', path: ['initialPayment'] },
);

export const updateOrderSchema = z.object({
  status: statusInput.optional(),
  undoStatusLogId: z.coerce.number().int().positive().optional(),
  payment: z.object({
    amount: z.coerce.number().int().positive(),
    method: legacyPaymentMethod,
  }).optional(),
  paymentStatus: z.enum(['UNPAID', 'PARTIAL', 'PAID']).optional(),
  paymentMethod: legacyPaymentMethod.optional(),
  rackLocation: z.string().trim().max(32).nullable().optional(),
  cancellationReason: z.string().trim().min(1).max(2000).optional(),
  verifiedInvoiceCode: z.string().trim().max(64).optional(),
  pickedUpBy: z.string().trim().max(191).optional(),
  allowUnpaid: z.boolean().optional(),
}).refine(
  (input) => Object.values(input).some((value) => value !== undefined),
  { message: 'Tidak ada perubahan yang dikirim.' },
).refine(
  (input) => !(input.payment && input.paymentStatus),
  { message: 'Kirim pembayaran sebagai satu entri riwayat.' },
).refine(
  (input) => input.undoStatusLogId === undefined || Object.keys(input).every((key) => key === 'undoStatusLogId'),
  { message: 'Urungkan status harus dikirim sebagai satu perubahan.' },
);

export const serviceInputSchema = z.object({
  name: z.string().trim().min(1).max(191),
  unitCode: z.enum(['PER_KG', 'PER_PCS', 'PER_M2']),
  regularPrice: z.coerce.number().int().nonnegative(),
  expressPrice: z.coerce.number().int().nonnegative().optional(),
  durationHrs: z.coerce.number().int().positive().max(8760),
  expressDurationHrs: z.coerce.number().int().positive().max(8760).optional(),
  stages: z.array(z.enum(productionStages)).max(productionStages.length),
  isActive: z.boolean().default(true),
}).refine(
  (service) => service.expressDurationHrs === undefined || service.expressDurationHrs < service.durationHrs,
  { message: 'Durasi express harus lebih singkat dari reguler.', path: ['expressDurationHrs'] },
).refine(
  (service) => service.expressPrice === undefined || service.expressPrice > service.regularPrice,
  { message: 'Tarif express harus lebih tinggi dari tarif reguler.', path: ['expressPrice'] },
).refine(
  (service) => new Set(service.stages).size === service.stages.length,
  { message: 'Tahap layanan tidak boleh berulang.', path: ['stages'] },
);

export const complaintInputSchema = z.object({
  type: z.enum(['COLOR_BLEEDING', 'LOST', 'DAMAGED', 'OTHER']),
  notes: z.string().trim().min(1).max(5000),
});

export const complaintUpdateSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']),
});

export const customerCreateSchema = z.object({
  name: customerName,
  phone: customerPhone,
  address: z.string().trim().max(5000).optional(),
});

export const staffInputSchema = z.object({
  name: z.string().trim().min(1).max(191),
  email: z.string().trim().email().max(191),
  password: z.string().min(8).max(128),
  role: z.enum(['SUPER_OWNER', 'OWNER', 'CASHIER', 'WASHER']),
  storeId: z.coerce.number().int().positive().optional(),
});

export const staffUpdateSchema = z.object({
  name: z.string().trim().min(1).max(191).optional(),
  role: z.enum(['OWNER', 'CASHIER', 'WASHER']).optional(),
  isActive: z.boolean().optional(),
}).refine(
  (input) => Object.values(input).some((value) => value !== undefined),
  { message: 'Tidak ada perubahan yang dikirim.' },
);

export const cashClosureInputSchema = z.object({
  businessDate: z.string().date(),
  cashCounted: z.coerce.number().int().nonnegative(),
  notes: z.string().trim().max(2000).optional(),
});

export const settingUpdateSchema = z.object({
  uncollectedReadyDays: z.coerce.number().int().min(1).max(365),
});

export const speedInputSchema = z.object({
  name: z.string().trim().min(1).max(191),
  priceMultiplier: z.coerce.number().finite().min(0.1).max(10),
  durationMultiplier: z.coerce.number().finite().min(0.1).max(10),
  isActive: z.boolean().default(true),
});

export const speedUpdateSchema = speedInputSchema.partial().refine(
  (input) => Object.values(input).some((value) => value !== undefined),
  { message: 'Tidak ada perubahan yang dikirim.' },
);

export const customerUpdateSchema = z.object({
  name: customerName.optional(),
  phone: customerPhone.optional(),
  address: z.string().trim().max(5000).nullable().optional(),
}).refine(
  (input) => Object.values(input).some((value) => value !== undefined),
  { message: 'Tidak ada perubahan yang dikirim.' },
);

export const storeInputSchema = z.object({
  name: z.string().trim().min(1, 'Nama toko wajib diisi.').max(191),
  code: z.string().trim().min(2, 'Kode toko minimal 2 karakter.').max(32).regex(/^[A-Za-z0-9_-]+$/, 'Kode toko hanya boleh huruf, angka, strip, dan underscore.'),
  address: z.string().trim().max(1000).optional(),
  phone: z.string().trim().max(32).optional(),
  ownerId: z.coerce.number().int().positive().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const storeUpdateSchema = storeInputSchema.partial().refine(
  (input) => Object.values(input).some((value) => value !== undefined),
  { message: 'Tidak ada perubahan yang dikirim.' },
);
