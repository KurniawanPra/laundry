'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, Clock3, PackageCheck, Wallet } from 'lucide-react';

type DashboardData = {
  actions: {
    readyUnpaid: { id: number; invoiceCode: string; totalAmount: number; paymentStatus: string; customer: { name: string; phone: string } }[];
    overdue: { id: number; invoiceCode: string; status: string; estimatedDone: string | null; customer: { name: string; phone: string } }[];
    uncollected: { id: number; invoiceCode: string; updatedAt: string; statusLogs: { changedAt: string }[]; customer: { name: string; phone: string } }[];
    uncollectedReadyDays: number;
  };
  daily: { date: string; orderCount: number; paymentTotals: { CASH: number; TRANSFER: number; QRIS: number }; totalPaid: number };
};

const money = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);

export default function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(true);

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
        <div className="h-20 animate-pulse bg-neutral-200" />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="h-28 animate-pulse bg-neutral-200" />
          <div className="h-28 animate-pulse bg-neutral-200" />
          <div className="h-28 animate-pulse bg-neutral-200" />
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
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-600">Tindak lanjuti pesanan yang membutuhkan perhatian.</p>
        <p className="mt-2 text-xs text-neutral-600" role="status">{!isOnline || error ? 'Koneksi terputus' : lastSynced ? `Sinkron: ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(lastSynced)}` : 'Menghubungkan...'}</p>
      </header>

      {(error || !isOnline) && <div role="alert" className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-red-300 bg-red-50 p-4 text-sm text-red-900"><span>{!isOnline ? 'Perangkat tidak terhubung ke internet.' : error}</span><button type="button" onClick={() => setRetry((value) => value + 1)} className="min-h-11 border border-red-400 px-3 font-semibold">Coba lagi</button></div>}

      <section aria-labelledby="actions-title" className="space-y-4">
        <h2 id="actions-title" className="text-xl font-semibold">Perlu ditindaklanjuti</h2>
        <div className="divide-y divide-neutral-200 rounded-[var(--radius-control)] border border-neutral-200 bg-white">
          {actionGroups.map((group) => {
            const Icon = group.icon;
            return (
              <Link key={group.title} href={group.href} className="flex min-h-20 items-start gap-4 p-4 hover:bg-neutral-50">
                <Icon size={20} className="mt-1 shrink-0 text-cyan-800" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-2 font-semibold">
                    {group.title}
                    <span className="text-sm tabular-nums text-neutral-600">{group.items.length} pesanan</span>
                  </span>
                  <span className="mt-1 block text-sm text-neutral-600">{group.description}</span>
                  {group.items.length > 0 && <span className="mt-2 block truncate text-sm text-neutral-800">{group.items.slice(0, 3).join(' · ')}</span>}
                </span>
                <ArrowRight size={20} className="mt-1 shrink-0 text-neutral-500" />
              </Link>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="daily-title" className="space-y-4">
        <div>
          <h2 id="daily-title" className="text-xl font-semibold">Ringkasan hari ini</h2>
          <p className="mt-1 text-sm text-neutral-600">{new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeZone: 'Asia/Jakarta' }).format(new Date(`${data.daily.date}T12:00:00+07:00`))}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Pesanan diterima', value: String(data.daily.orderCount) },
            { label: 'Pembayaran masuk', value: money(data.daily.totalPaid) },
            { label: 'Tunai', value: money(data.daily.paymentTotals.CASH) },
            { label: 'Transfer / QRIS', value: money(data.daily.paymentTotals.TRANSFER + data.daily.paymentTotals.QRIS) },
          ].map((item) => (
            <div key={item.label} className="rounded-[var(--radius-control)] border border-neutral-200 bg-white p-4">
              <p className="text-sm text-neutral-600">{item.label}</p>
              <p className="mt-3 text-xl font-semibold tabular-nums">{item.value}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
