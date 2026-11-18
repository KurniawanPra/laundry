'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, ChevronLeft, ChevronRight, Clock3, Globe, PackageCheck, Store, Wallet } from 'lucide-react';

type StoreBreakdown = {
  id: number;
  code: string;
  name: string;
  address: string | null;
  ownerName: string;
  todayOrders: number;
  activeOrders: number;
  todayRevenue: number;
};

type DashboardData = {
  actions: {
    readyUnpaid: { id: number; invoiceCode: string; totalAmount: number; paymentStatus: string; customer: { name: string; phone: string } }[];
    overdue: { id: number; invoiceCode: string; status: string; estimatedDone: string | null; customer: { name: string; phone: string } }[];
    uncollected: { id: number; invoiceCode: string; updatedAt: string; statusLogs: { changedAt: string }[]; customer: { name: string; phone: string } }[];
    uncollectedReadyDays: number;
  };
  daily: { date: string; orderCount: number; paymentTotals: { CASH: number; TRANSFER: number; QRIS: number }; totalPaid: number };
  activeStore?: { id: number; code: string; name: string } | null;
  multiStore?: {
    isGlobal: boolean;
    totalStores: number;
    storesBreakdown: StoreBreakdown[];
  } | null;
};

const money = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);

export default function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [storePage, setStorePage] = useState(1);
  const STORES_PER_PAGE = 10;

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/reports/dashboard', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal memuat ringkasan.');
      setData(result as DashboardData);
      setError('');
      setLastSynced(new Date());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tidak dapat terhubung ke server.');
    }
  }, []);

  async function switchToStore(storeId: number) {
    try {
      const res = await fetch('/api/stores/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId }),
      });
      if (!res.ok) throw new Error('Gagal beralih toko.');
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal beralih toko.');
    }
  }

  useEffect(() => {
    const firstSync = window.setTimeout(() => { void refresh(); }, 0);
    const initialNetworkState = window.setTimeout(() => setIsOnline(navigator.onLine), 0);
    const syncWhenVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const syncWhenOnline = () => {
      setIsOnline(true);
      void refresh();
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
  }, [refresh, retry]);

  if (error && !data) {
    return (
      <section className="rounded-[var(--radius-control)] border border-red-300 bg-white p-6" role="alert">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="mt-0.5 text-red-700" />
          <div className="flex-1">
            <h1 className="font-semibold">Ringkasan belum dapat dimuat</h1>
            <p className="mt-1 text-sm text-neutral-700">{error}</p>
            <button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-4 min-h-11 border border-neutral-400 px-4 text-sm font-medium hover:bg-neutral-100">Coba lagi</button>
          </div>
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <div aria-label="Memuat ringkasan" className="space-y-4">
        <div className="h-20 animate-pulse bg-neutral-200 dark:bg-neutral-800" />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="h-28 animate-pulse bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-28 animate-pulse bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-28 animate-pulse bg-neutral-200 dark:bg-neutral-800" />
        </div>
      </div>
    );
  }

  const actionGroups = [
    {
      title: 'Siap diambil, belum lunas',
      description: 'Selesaikan pembayaran sebelum serah-terima.',
      icon: Wallet,
      href: '/orders?status=READY&payment=unpaid',
      items: data.actions.readyUnpaid.map((order) => `${order.invoiceCode} - ${order.customer.name} - ${money(order.totalAmount)}`),
    },
    {
      title: 'Melewati estimasi selesai',
      description: 'Periksa pesanan yang belum selesai sesuai estimasi.',
      icon: Clock3,
      href: '/orders?overdue=1',
      items: data.actions.overdue.map((order) => `${order.invoiceCode} - ${order.customer.name}`),
    },
    {
      title: `Belum diambil lebih dari ${data.actions.uncollectedReadyDays} hari`,
      description: 'Hubungi pelanggan atau cek lokasi rak.',
      icon: PackageCheck,
      href: '/orders?uncollected=1',
      items: data.actions.uncollected.map((order) => `${order.invoiceCode} - ${order.customer.name}`),
    },
  ];

  return (
    <div className="space-y-8">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold">Dashboard</h1>
            <div className="mt-1 flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-400">
              {data.activeStore ? (
                <>
                  <Store size={15} className="shrink-0 text-cyan-700 dark:text-cyan-400" />
                  <span>Cabang aktif: <strong className="text-neutral-800 dark:text-neutral-200">[{data.activeStore.code}] {data.activeStore.name}</strong></span>
                </>
              ) : (
                <>
                  <Globe size={15} className="shrink-0 text-cyan-700 dark:text-cyan-400" />
                  <span>Tampilan Global: <strong className="text-neutral-800 dark:text-neutral-200">Semua Cabang</strong></span>
                </>
              )}
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400" role="status">
          {!isOnline || error ? 'Koneksi terputus' : lastSynced ? `Sinkron: ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(lastSynced)}` : 'Menghubungkan...'}
        </p>
      </header>

      {(error || !isOnline) && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300">
          <span>{!isOnline ? 'Perangkat tidak terhubung ke internet.' : error}</span>
          <button type="button" onClick={() => setRetry((value) => value + 1)} className="min-h-11 border border-red-400 px-3 font-semibold dark:border-red-700">Coba lagi</button>
        </div>
      )}

      {/* Super Owner Multi-Store Performance Section */}
      {data.multiStore && (
        <section aria-labelledby="multistore-title" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="multistore-title" className="flex items-center gap-2 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                <Store size={22} className="text-cyan-700 dark:text-cyan-400" />
                Ringkasan Semua Cabang (Super Owner)
              </h2>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                Memantau performa {data.multiStore.totalStores} cabang aktif secara terpusat.
              </p>
            </div>
            <Link
              href="/stores"
              className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] border border-cyan-800 px-3 text-sm font-semibold text-cyan-900 hover:bg-cyan-50 dark:border-cyan-600 dark:text-cyan-300 dark:hover:bg-cyan-950/60"
            >
              Kelola Toko & Cabang
              <ArrowRight size={16} />
            </Link>
          </div>

          <div className="overflow-x-auto rounded-[var(--radius-control)] border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-neutral-300 bg-neutral-100 text-xs font-semibold uppercase tracking-wide text-neutral-700 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-300">
                <tr>
                  <th className="px-4 py-3">Cabang</th>
                  <th className="px-4 py-3">Pemilik</th>
                  <th className="px-4 py-3 text-center">Pesanan Hari Ini</th>
                  <th className="px-4 py-3 text-center">Pesanan Aktif</th>
                  <th className="px-4 py-3 text-right">Omset Hari Ini</th>
                  <th className="px-4 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {data.multiStore.storesBreakdown
                  .slice((storePage - 1) * STORES_PER_PAGE, storePage * STORES_PER_PAGE)
                  .map((st) => (
                  <tr key={st.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 font-semibold text-neutral-900 dark:text-neutral-100">
                        <span className="rounded bg-cyan-100 px-1.5 py-0.5 text-xs font-bold text-cyan-900 dark:bg-cyan-950 dark:text-cyan-300">
                          {st.code}
                        </span>
                        {st.name}
                      </div>
                      {st.address && <p className="mt-0.5 max-w-xs truncate text-xs text-neutral-500 dark:text-neutral-400">{st.address}</p>}
                    </td>
                    <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">{st.ownerName}</td>
                    <td className="px-4 py-3 text-center font-medium tabular-nums text-neutral-900 dark:text-neutral-100">{st.todayOrders}</td>
                    <td className="px-4 py-3 text-center font-medium tabular-nums text-neutral-900 dark:text-neutral-100">{st.activeOrders}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{money(st.todayRevenue)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => switchToStore(st.id)}
                        className="rounded border border-neutral-300 px-2.5 py-1 text-xs font-medium text-cyan-900 hover:bg-neutral-100 dark:border-neutral-700 dark:text-cyan-400 dark:hover:bg-neutral-800"
                      >
                        Buka Toko
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {data.multiStore.storesBreakdown.length > 0 && (
              <div className="flex flex-col items-center justify-between gap-3 border-t border-neutral-200 bg-neutral-50/50 px-4 py-3 sm:flex-row dark:border-neutral-800 dark:bg-neutral-900/50">
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  Menampilkan <span className="font-semibold text-neutral-900 dark:text-neutral-100">{(storePage - 1) * STORES_PER_PAGE + 1}</span> - <span className="font-semibold text-neutral-900 dark:text-neutral-100">{Math.min(storePage * STORES_PER_PAGE, data.multiStore.storesBreakdown.length)}</span> dari <span className="font-semibold text-neutral-900 dark:text-neutral-100">{data.multiStore.storesBreakdown.length}</span> cabang
                </p>
                {Math.ceil(data.multiStore.storesBreakdown.length / STORES_PER_PAGE) > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={storePage <= 1}
                      onClick={() => setStorePage((p) => Math.max(1, p - 1))}
                      aria-label="Halaman cabang sebelumnya"
                      className="flex h-8 w-8 items-center justify-center rounded border border-neutral-300 bg-white text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="px-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      {storePage} / {Math.ceil(data.multiStore.storesBreakdown.length / STORES_PER_PAGE)}
                    </span>
                    <button
                      type="button"
                      disabled={storePage >= Math.ceil(data.multiStore.storesBreakdown.length / STORES_PER_PAGE)}
                      onClick={() => setStorePage((p) => Math.min(Math.ceil((data.multiStore?.storesBreakdown.length ?? 0) / STORES_PER_PAGE), p + 1))}
                      aria-label="Halaman cabang selanjutnya"
                      className="flex h-8 w-8 items-center justify-center rounded border border-neutral-300 bg-white text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      <section aria-labelledby="actions-title" className="space-y-4">
        <h2 id="actions-title" className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Perlu ditindaklanjuti</h2>
        <div className="divide-y divide-neutral-200 rounded-[var(--radius-control)] border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
          {actionGroups.map((group) => {
            const Icon = group.icon;
            return (
              <Link key={group.title} href={group.href} className="flex min-h-20 items-start gap-4 p-4 transition hover:bg-neutral-50 dark:hover:bg-neutral-800/60">
                <Icon size={20} className="mt-1 shrink-0 text-cyan-800 dark:text-cyan-400" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-2 font-semibold text-neutral-900 dark:text-neutral-100">
                    {group.title}
                    <span className="text-sm tabular-nums text-neutral-600 dark:text-neutral-400">{group.items.length} pesanan</span>
                  </span>
                  <span className="mt-1 block text-sm text-neutral-600 dark:text-neutral-400">{group.description}</span>
                  {group.items.length > 0 && <span className="mt-2 block truncate text-sm text-neutral-800 dark:text-neutral-200">{group.items.slice(0, 3).join(' · ')}</span>}
                </span>
                <ArrowRight size={20} className="mt-1 shrink-0 text-neutral-500 dark:text-neutral-400" />
              </Link>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="daily-title" className="space-y-4">
        <div>
          <h2 id="daily-title" className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Ringkasan hari ini</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeZone: 'Asia/Jakarta' }).format(new Date(`${data.daily.date}T12:00:00+07:00`))}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Pesanan diterima', value: String(data.daily.orderCount) },
            { label: 'Pembayaran masuk', value: money(data.daily.totalPaid) },
            { label: 'Tunai', value: money(data.daily.paymentTotals.CASH) },
            { label: 'Transfer / QRIS', value: money(data.daily.paymentTotals.TRANSFER + data.daily.paymentTotals.QRIS) },
          ].map((item) => (
            <div key={item.label} className="rounded-[var(--radius-control)] border border-neutral-200 bg-white p-4 transition-colors dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">{item.label}</p>
              <p className="mt-3 text-xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{item.value}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
