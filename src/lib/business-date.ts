import { z } from 'zod';
import { ApiError } from '@/lib/api-utils';

const dateSchema = z.string().date();
const jakartaOffset = '+07:00';

export function getBusinessDateRange(dateValue: string | null) {
  const parsed = dateSchema.safeParse(dateValue ?? '');
  if (!parsed.success) throw new ApiError('Tanggal harus berformat YYYY-MM-DD.', 400);
  const start = new Date(`${parsed.data}T00:00:00.000${jakartaOffset}`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const businessDate = new Date(`${parsed.data}T00:00:00.000Z`);
  return { date: parsed.data, businessDate, start, end };
}

export function todayBusinessDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
