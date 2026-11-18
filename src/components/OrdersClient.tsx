'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle, CheckCircle2, Clock3, MoreHorizontal, PackageCheck,
  Phone, Plus, Receipt, Search, Shirt, WashingMachine, Wind, X,
} from 'lucide-react';
import { useCurrentUser } from '@/components/AppShell';
import { Badge } from '@/components/ui';
import { getNextOrderStatus, isProductionStage } from '@/lib/laundry-domain';
import type { OrderStatus, PaymentStatus } from '@/lib/laundry-domain';

type OrderRow = {
  id: number;
  invoiceCode: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string | null;
  totalAmount: number;
  estimatedDone: string | null;
  rackLocation: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { name: string; phone: string };
  items: {
    id: number;
    serviceName: string;
    unitCode: 'PER_KG' | 'PER_PCS' | 'PER_M2';
    rateType: 'REGULAR' | 'EXPRESS';
    quantity: number;
    subtotal: number;
    workflowStages: string;
  }[];
  payments: { id: number; amount: number; method: string; paidAt: string }[];
  statusLogs: { toStatus: OrderStatus; changedAt: string }[];
  store?: { id: number; name: string; code: string } | null;
};

const statuses: { value: OrderStatus; label: string; icon: typeof Receipt }[] = [
  { value: 'RECEIVED', label: 'Diterima', icon: Receipt },
  { value: 'QUEUED', label: 'Antrian', icon: Clock3 },
  { value: 'WASHING', label: 'Dicuci', icon: WashingMachine },
  { value: 'DRYING', label: 'Dikeringkan', icon: Wind },
  { value: 'IRONING', label: 'Disetrika', icon: Shirt },
  { value: 'PACKAGED', label: 'Dikemas', icon: PackageCheck },
  { value: 'READY', label: 'Siap diambil', icon: PackageCheck },
  { value: 'COMPLETED', label: 'Selesai', icon: CheckCircle2 },
  { value: 'CANCELLED', label: 'Dibatalkan', icon: X },
];

const unitLabels = { PER_KG: 'kg', PER_PCS: 'pcs', PER_M2: 'm²' } as const;
const money = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
const dateTime = (value: string | null) => value
  ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value))
  : 'Belum ditentukan';

function StatusBadge({ status }: { status: OrderStatus }) {
  const config = statuses.find((item) => item.value === status);
  const Icon = config?.icon ?? Receipt;
  const tone = status === 'CANCELLED' ? 'danger' : status === 'READY' ? 'success' : 'neutral';
  return <Badge icon={Icon} tone={tone}>{config?.label ?? status}</Badge>;
}

function PaymentBadge({ status }: { status: PaymentStatus }) {
  const label = status === 'PAID' ? 'Lunas' : status === 'PARTIAL' ? 'DP' : 'Belum bayar';
  const tone = status === 'PAID' ? 'success' : 'warning';
  return <Badge icon={Receipt} tone={tone}>{label}</Badge>;
}

export default function OrdersClient() {
  const user = useCurrentUser();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'ALL');
  const [paymentFilter, setPaymentFilter] = useState(searchParams.get('payment') || 'ALL');
  const [specialFilter, setSpecialFilter] = useState(searchParams.get('overdue') ? 'overdue' : searchParams.get('uncollected') ? 'uncollected' : '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [uncollectedReadyDays, setUncollectedReadyDays] = useState(7);
  const [isOnline, setIsOnline] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const refreshLock = useRef(false);

  useEffect(() => {
    if (openMenuId === null) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-order-menu]')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuId]);

  const refreshOrders = useCallback(async () => {
    if (refreshLock.current) return;
    refreshLock.current = true;
    try {
      const [response, settingsResponse] = await Promise.all([
        fetch('/api/orders', { cache: 'no-store' }),
        fetch('/api/settings', { cache: 'no-store' }),
      ]);
      const [result, settingResult] = await Promise.all([response.json(), settingsResponse.json()]);
      if (!response.ok) throw new Error(result.error || 'Gagal memuat pesanan.');
      if (!settingsResponse.ok) throw new Error(settingResult.error || 'Gagal memuat pengaturan.');
      setOrders(result as OrderRow[]);
      setUncollectedReadyDays(Number(settingResult.uncollectedReadyDays));
      setError('');
      setLastSynced(new Date());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tidak dapat terhubung ke server.');
    } finally {
      setLoading(false);
      refreshLock.current = false;
    }
  }, []);

  useEffect(() => {
    const firstSync = window.setTimeout(() => { void refreshOrders(); }, 0);
    const initialNetworkState = window.setTimeout(() => setIsOnline(navigator.onLine), 0);
    const syncWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshOrders();
    };
    const syncWhenOnline = () => {
      setIsOnline(true);
      void refreshOrders();
    };
    const markOffline = () => setIsOnline(false);
    const intervalId = window.setInterval(syncWhenVisible, 30_000);
    document.addEventListener('visibilitychange', syncWhenVisible);
    window.addEventListener('online', syncWhenOnline);
    window.addEventListener('offline', markOffline);
    return () => {
      window.clearTimeout(firstSync);
      window.clearTimeout(initialNetworkState);
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', syncWhenVisible);
      window.removeEventListener('online', syncWhenOnline);
      window.removeEventListener('offline', markOffline);
    };
  }, [refreshOrders, retry]);

  const counts = useMemo(() => {
    const result: Record<string, number> = { ALL: orders.length };
    for (const status of statuses) result[status.value] = orders.filter((order) => order.status === status.value).length;
    return result;
  }, [orders]);

  const visibleOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    const now = lastSynced?.getTime() ?? 0;
    return orders.filter((order) => {
      const searchable = `${order.invoiceCode} ${order.customer.name} ${order.customer.phone}`.toLowerCase();
      if (term && !searchable.includes(term)) return false;
      if (statusFilter !== 'ALL' && order.status !== statusFilter) return false;
      if (paymentFilter === 'unpaid' && order.paymentStatus === 'PAID') return false;
      if (paymentFilter === 'paid' && order.paymentStatus !== 'PAID') return false;
      if (specialFilter === 'overdue' && (!order.estimatedDone || new Date(order.estimatedDone).getTime() >= now || ['COMPLETED', 'CANCELLED'].includes(order.status))) return false;
      if (specialFilter === 'uncollected') {
        const readyAt = order.statusLogs.filter((log) => log.toStatus === 'READY').at(-1)?.changedAt;
        if (order.status !== 'READY' || !readyAt || now - new Date(readyAt).getTime() < uncollectedReadyDays * 86400000) return false;
      }
      return true;
    });
  }, [orders, search, statusFilter, paymentFilter, specialFilter, lastSynced, uncollectedReadyDays]);

  const canCreate = user.role === 'SUPER_OWNER' || user.role === 'OWNER' || user.role === 'CASHIER';

  function getNextStatus(order: OrderRow) {
    const stages = [...new Set(order.items.flatMap((item) => item.workflowStages.split(',').filter(isProductionStage)))];
    return getNextOrderStatus(order.status, stages);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Pesanan</h1>
          <p className="mt-1 text-sm text-neutral-600">Kelola antrean dan progres cucian sampai serah-terima.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canCreate && (
            <Link href="/orders/new" className="inline-flex min-h-11 items-center gap-2 bg-cyan-800 px-4 text-sm font-semibold text-white hover:bg-cyan-900">
              <Plus size={18} />
              Transaksi baru
            </Link>
          )}
          <div className="text-right text-xs text-neutral-600" role="status">
            {!isOnline || error ? <span className="text-red-800">Koneksi terputus</span> : lastSynced ? `Sinkron: ${dateTime(lastSynced.toISOString())}` : 'Menghubungkan...'}
          </div>
        </div>
      </header>

      {(error || !isOnline) && (
        <div role="alert" className="flex items-center gap-3 border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <AlertCircle size={20} />
          <span className="flex-1">{!isOnline ? 'Perangkat tidak terhubung ke internet.' : error}</span>
          <button type="button" onClick={() => setRetry((value) => value + 1)} className="min-h-11 border border-red-400 px-3 font-medium">Coba lagi</button>
        </div>
      )}

      <section className="space-y-4">
        <div className="relative max-w-lg">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 dark:text-neutral-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari invoice, pelanggan, atau nomor telepon" className="min-h-11 w-full rounded-[var(--radius-control)] border border-neutral-400 bg-white pl-12 pr-3 text-base text-neutral-900 outline-none focus:border-cyan-800 focus:ring-2 focus:ring-cyan-800/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-cyan-500 dark:focus:ring-cyan-500/20" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 pt-1 scroll-smooth [-ms-overflow-style:none] [scrollbar-width:thin]" role="tablist" aria-label="Filter tahap cucian">
          {[{ value: 'ALL', label: 'Semua', icon: Receipt }, ...statuses].map((status) => {
            const active = statusFilter === status.value;
            const Icon = status.icon;
            return (
              <button
                key={status.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => { setStatusFilter(status.value); setSpecialFilter(''); }}
                className={`group flex min-h-11 shrink-0 items-center gap-2 rounded-[var(--radius-control)] border px-3 text-sm transition ${
                  active
                    ? 'border-cyan-700 bg-cyan-700 font-semibold text-white shadow-sm ring-2 ring-cyan-700/20 dark:border-cyan-600 dark:bg-cyan-600 dark:text-white dark:ring-cyan-500/20'
                    : 'border-neutral-300 bg-white text-neutral-700 hover:border-cyan-600 hover:bg-cyan-50/60 hover:text-cyan-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-cyan-500 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-200'
                }`}
              >
                <Icon size={16} className={active ? 'text-white' : 'text-neutral-500 transition-colors group-hover:text-cyan-700 dark:text-neutral-400 dark:group-hover:text-cyan-400'} />
                <span>{status.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums font-semibold ${
                  active
                    ? 'bg-white/25 text-white'
                    : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                }`}>
                  {counts[status.value] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <label htmlFor="payment-filter" className="text-sm font-medium text-neutral-900 dark:text-neutral-200">Pembayaran:</label>
          <select
            id="payment-filter"
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value)}
            className="min-h-10 rounded-[var(--radius-control)] border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-900 outline-none transition hover:border-cyan-600 focus:border-cyan-700 focus:ring-2 focus:ring-cyan-700/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:border-cyan-500 dark:focus:border-cyan-500"
          >
            <option value="ALL">Semua Pembayaran</option>
            <option value="unpaid">Belum lunas</option>
            <option value="paid">Lunas</option>
          </select>
          {specialFilter && (
            <button
              type="button"
              onClick={() => setSpecialFilter('')}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--radius-control)] border border-cyan-700 bg-cyan-50 px-3 text-xs font-semibold text-cyan-900 transition hover:bg-cyan-100 dark:border-cyan-600 dark:bg-cyan-950/60 dark:text-cyan-300 dark:hover:bg-cyan-900/60"
            >
              <X size={14} />
              Hapus filter tindakan
            </button>
          )}
        </div>
      </section>

      {loading ? (
        <div aria-label="Memuat pesanan" className="space-y-2">
          {[0, 1, 2].map((row) => <div key={row} className="h-16 animate-pulse rounded-[var(--radius-control)] bg-neutral-200 dark:bg-neutral-800" />)}
        </div>
      ) : error && orders.length === 0 ? null : visibleOrders.length === 0 ? (
        <section className="rounded-[var(--radius-control)] border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900">
          <Receipt size={20} className="mx-auto text-neutral-500 dark:text-neutral-400" />
          <h2 className="mt-3 font-semibold text-neutral-900 dark:text-neutral-100">{orders.length ? 'Tidak ada pesanan yang cocok' : 'Belum ada pesanan'}</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{orders.length ? 'Coba ubah kata pencarian atau filter.' : 'Transaksi baru akan tampil di sini setelah diterima.'}</p>
          {canCreate && <Link href="/orders/new" className="mt-4 inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-cyan-800 px-4 text-sm font-semibold text-cyan-900 hover:bg-cyan-50 dark:border-cyan-600 dark:text-cyan-400 dark:hover:bg-cyan-950/60">Buat transaksi</Link>}
        </section>
      ) : (
        <>
          <div className="hidden min-h-[300px] overflow-x-auto rounded-[var(--radius-control)] border border-neutral-200 bg-white lg:block dark:border-neutral-800 dark:bg-neutral-900">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-neutral-300 bg-neutral-100 text-xs font-semibold uppercase tracking-wide text-neutral-700 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-300">
                <tr>
                  <th className="px-3 py-3">Invoice / Pelanggan</th>
                  <th className="px-3 py-3">Layanan</th>
                  <th className="px-3 py-3">Status cucian</th>
                  <th className="px-3 py-3">Pembayaran</th>
                  <th className="px-3 py-3 text-right">Total</th>
                  <th className="px-3 py-3">Estimasi</th>
                  <th className="px-3 py-3">Rak</th>
                  <th className="px-3 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {visibleOrders.map((order, index) => {
                  const isLast = visibleOrders.length > 1 && index === visibleOrders.length - 1;
                  return (
                    <tr key={order.id} className="align-top hover:bg-neutral-50 dark:hover:bg-neutral-800/60">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <Link href={`/orders/${order.id}`} className="font-semibold text-cyan-900 underline-offset-2 hover:underline dark:text-cyan-400">{order.invoiceCode}</Link>
                          {order.store && (
                            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                              {order.store.code}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-neutral-900 dark:text-neutral-100">{order.customer.name}</p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-neutral-600 dark:text-neutral-400"><Phone size={16} />{order.customer.phone}</p>
                      </td>
                      <td className="px-3 py-3 text-neutral-800 dark:text-neutral-200">{order.items.map((item) => <p key={item.id}>{item.serviceName} · {item.quantity} {unitLabels[item.unitCode]}</p>)}</td>
                      <td className="px-3 py-3"><StatusBadge status={order.status} /></td>
                      <td className="px-3 py-3"><PaymentBadge status={order.paymentStatus} /></td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{money(order.totalAmount)}</td>
                      <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">{dateTime(order.estimatedDone)}</td>
                      <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">{order.rackLocation || '-'}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Link href={`/orders/${order.id}`} className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-cyan-800 px-3 text-xs font-semibold text-cyan-900 hover:bg-cyan-50 dark:border-cyan-600 dark:text-cyan-400 dark:hover:bg-cyan-950/60">Buka</Link>
                          <div className="relative" data-order-menu>
                            <button
                              type="button"
                              aria-expanded={openMenuId === order.id}
                              aria-label={`Aksi lain ${order.invoiceCode}`}
                              onClick={() => setOpenMenuId((current) => (current === order.id ? null : order.id))}
                              className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-[var(--radius-control)] border border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                            >
                              <MoreHorizontal size={20} />
                            </button>
                            {openMenuId === order.id && (
                              <div
                                className={`absolute right-0 z-30 w-44 rounded-[var(--radius-control)] border border-neutral-300 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800 ${
                                  isLast ? 'bottom-full mb-1' : 'top-full mt-1'
                                }`}
                              >
                                <a
                                  href={`https://wa.me/${order.customer.phone.replace(/\D/g, '').replace(/^0/, '62')}?text=${encodeURIComponent(`Invoice ${order.invoiceCode} - ${order.customer.name}`)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={() => setOpenMenuId(null)}
                                  className="flex min-h-11 items-center px-3 text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-700"
                                >
                                  Buka WhatsApp
                                </a>
                                {getNextStatus(order) && (
                                  <Link
                                    href={`/orders/${order.id}`}
                                    onClick={() => setOpenMenuId(null)}
                                    className="flex min-h-11 items-center px-3 text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-700"
                                  >
                                    Lanjutkan proses
                                  </Link>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 lg:hidden">
            {visibleOrders.map((order) => (
              <article key={order.id} className="space-y-3 rounded-[var(--radius-control)] border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Link href={`/orders/${order.id}`} className="font-semibold text-cyan-900 underline-offset-2 hover:underline dark:text-cyan-400">{order.invoiceCode}</Link>
                      {order.store && (
                        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                          {order.store.code}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm text-neutral-900 dark:text-neutral-100">{order.customer.name}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-neutral-600 dark:text-neutral-400"><Phone size={16} />{order.customer.phone}</p>
                  </div>
                  <p className="shrink-0 text-right font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{money(order.totalAmount)}</p>
                </div>
                <div className="flex flex-wrap gap-2"><StatusBadge status={order.status} /><PaymentBadge status={order.paymentStatus} /></div>
                <div className="text-sm text-neutral-700">
                  <p>{order.items.map((item) => `${item.serviceName}, ${item.quantity} ${unitLabels[item.unitCode]}`).join(' · ')}</p>
                  <p className="mt-1">Estimasi: {dateTime(order.estimatedDone)}{order.rackLocation ? ` · Rak ${order.rackLocation}` : ''}</p>
                </div>
                <Link href={`/orders/${order.id}`} className="flex min-h-11 w-full items-center justify-center border border-cyan-800 text-sm font-semibold text-cyan-900 hover:bg-cyan-50">Buka pesanan</Link>
              </article>
            ))}
          </div>
        </>
      )}
      {!loading && <p className="text-xs text-neutral-600" aria-live="polite">Menampilkan {visibleOrders.length} dari {orders.length} pesanan.</p>}
    </div>
  );
}
