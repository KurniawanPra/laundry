'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Banknote, CalendarDays, Receipt } from 'lucide-react';
import { useCurrentUser } from '@/components/AppShell';
import { Card } from '@/components/ui';

type DailyReport = {
  date: string;
  orderCount: number;
  paidOrderCount: number;
  paymentTotals: { CASH: number; TRANSFER: number; QRIS: number };
  totalPaid: number;
};

type Closure = {
  id: number;
  businessDate: string;
  orderCount: number;
  cashTotal: number;
  transferTotal: number;
  qrisTotal: number;
  cashCounted: number;
  cashDifference: number;
  notes: string | null;
  createdAt: string;
  staff: { id: number; name: string };
};

const money = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);

export default function ReportsClient() {
  const user = useCurrentUser();
  const [date, setDate] = useState('');
  const [report, setReport] = useState<DailyReport | null>(null);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [cashCounted, setCashCounted] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const suffix = date ? `?date=${encodeURIComponent(date)}` : '';
      const [reportResponse, closureResponse] = await Promise.all([
        fetch(`/api/reports/daily${suffix}`, { cache: 'no-store' }),
        fetch(`/api/cash-closures${suffix}`, { cache: 'no-store' }),
      ]);
      const [reportResult, closureResult] = await Promise.all([reportResponse.json(), closureResponse.json()]);
      if (!reportResponse.ok) throw new Error(reportResult.error || 'Gagal memuat laporan.');
      if (!closureResponse.ok) throw new Error(closureResult.error || 'Gagal memuat tutup kas.');
      setReport(reportResult as DailyReport);
      setClosures(closureResult.closures as Closure[]);
      if (!date) setDate((reportResult as DailyReport).date);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tidak dapat terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh, retry]);

  async function closeCash(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!report) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/cash-closures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessDate: date || report.date, cashCounted: Number(cashCounted), notes }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal menutup kas.');
      setCashCounted('');
      setNotes('');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tidak dapat terhubung ke server.');
    } finally {
      setSaving(false);
    }
  }

  const ownClosureExists = closures.some((closure) => closure.staff.id === user.id);
  const paymentTotals = report?.paymentTotals ?? { CASH: 0, TRANSFER: 0, QRIS: 0 };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Laporan dan tutup kas</h1><p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Rekap berdasarkan waktu Indonesia Barat.</p></div>
        <label className="text-sm font-medium text-neutral-900 dark:text-neutral-200">Tanggal
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="ml-2 min-h-11 rounded-[var(--radius-control)] border border-neutral-400 bg-white px-3 text-base text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100" />
        </label>
      </header>

      {error && <div role="alert" className="flex items-center gap-3 border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300"><AlertCircle size={20} /><span className="flex-1">{error}</span><button type="button" onClick={() => setRetry((value) => value + 1)} className="min-h-11 border border-red-400 px-3 dark:border-red-700">Coba lagi</button></div>}

      {loading ? (
        <div aria-label="Memuat laporan" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-[var(--radius-control)] bg-neutral-200 dark:bg-neutral-800" />)}</div>
      ) : report ? (
        <>
          <section aria-label="Ringkasan harian" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Pesanan diterima', value: report.orderCount, icon: Receipt },
              { label: 'Pesanan dengan pembayaran', value: report.paidOrderCount, icon: CalendarDays },
              { label: 'Pembayaran masuk', value: money(report.totalPaid), icon: Banknote },
              { label: 'Tunai', value: money(paymentTotals.CASH), icon: Banknote },
            ].map((item) => {
              const Icon = item.icon;
              return <Card key={item.label} className="p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm text-neutral-600 dark:text-neutral-400">{item.label}</p><Icon size={20} className="text-cyan-800 dark:text-cyan-400" /></div><p className="mt-4 text-xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{item.value}</p></Card>;
            })}
          </section>

          <section className="rounded-[var(--radius-control)] border border-neutral-200 bg-white p-4 sm:p-6 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Rincian pembayaran</h2>
            <dl className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
              <div className="flex justify-between gap-4 py-3 text-sm text-neutral-700 dark:text-neutral-300"><dt>Tunai</dt><dd className="font-medium tabular-nums text-neutral-900 dark:text-neutral-100">{money(paymentTotals.CASH)}</dd></div>
              <div className="flex justify-between gap-4 py-3 text-sm text-neutral-700 dark:text-neutral-300"><dt>Transfer</dt><dd className="font-medium tabular-nums text-neutral-900 dark:text-neutral-100">{money(paymentTotals.TRANSFER)}</dd></div>
              <div className="flex justify-between gap-4 py-3 text-sm text-neutral-700 dark:text-neutral-300"><dt>QRIS</dt><dd className="font-medium tabular-nums text-neutral-900 dark:text-neutral-100">{money(paymentTotals.QRIS)}</dd></div>
              <div className="flex justify-between gap-4 py-3 font-semibold text-neutral-900 dark:text-neutral-100"><dt>Total pembayaran</dt><dd className="tabular-nums">{money(report.totalPaid)}</dd></div>
            </dl>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-[var(--radius-control)] border border-neutral-200 bg-white p-4 sm:p-6 dark:border-neutral-800 dark:bg-neutral-900">
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Tutup kas</h2>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Selisih dihitung dari uang tunai yang dihitung dikurangi transaksi tunai tercatat.</p>
              {ownClosureExists ? (
                <p className="mt-4 border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">Kasir ini sudah menutup kas pada tanggal tersebut.</p>
              ) : (
                <form onSubmit={closeCash} className="mt-4 space-y-4">
                  <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-200">Uang tunai fisik (Rp)
                    <input type="number" min="0" step="1" required value={cashCounted} onChange={(event) => setCashCounted(event.target.value)} className="mt-1 min-h-11 w-full rounded-[var(--radius-control)] border border-neutral-400 bg-white px-3 text-base tabular-nums text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100" />
                  </label>
                  {cashCounted !== '' && <p className="text-sm text-neutral-700 dark:text-neutral-300">Perkiraan selisih: <strong className="tabular-nums text-neutral-900 dark:text-neutral-100">{money(Number(cashCounted) - paymentTotals.CASH)}</strong></p>}
                  <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-200">Catatan (opsional)
                    <textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 w-full rounded-[var(--radius-control)] border border-neutral-400 bg-white p-3 text-base text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100" />
                  </label>
                  <button type="submit" disabled={saving} className="min-h-11 rounded-[var(--radius-control)] bg-cyan-800 px-4 text-sm font-semibold text-white hover:bg-cyan-900 disabled:opacity-50 dark:bg-cyan-600 dark:hover:bg-cyan-500">{saving ? 'Menyimpan...' : 'Simpan tutup kas'}</button>
                </form>
              )}
            </div>

            <div className="rounded-[var(--radius-control)] border border-neutral-200 bg-white p-4 sm:p-6 dark:border-neutral-800 dark:bg-neutral-900">
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Riwayat tutup kas</h2>
              {closures.length === 0 ? <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">Belum ada kasir yang menutup kas pada tanggal tersebut.</p> : (
                <ul className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                  {closures.map((closure) => <li key={closure.id} className="space-y-2 py-4 text-sm">
                    <div className="flex justify-between gap-3"><span className="font-medium text-neutral-900 dark:text-neutral-100">{closure.staff.name}</span><span className="text-neutral-600 dark:text-neutral-400">{new Intl.DateTimeFormat('id-ID', { timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(closure.createdAt))}</span></div>
                    <div className="grid grid-cols-2 gap-2 text-neutral-700 dark:text-neutral-300"><span>Pesanan: {closure.orderCount}</span><span>Tunai: {money(closure.cashTotal)}</span><span>Transfer: {money(closure.transferTotal)}</span><span>QRIS: {money(closure.qrisTotal)}</span><span>Fisik: {money(closure.cashCounted)}</span><span>Selisih: {money(closure.cashDifference)}</span></div>
                    {closure.notes && <p className="text-neutral-600 dark:text-neutral-400">{closure.notes}</p>}
                  </li>)}
                </ul>
              )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
