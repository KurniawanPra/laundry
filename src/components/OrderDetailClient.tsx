'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, ArrowLeft, Banknote, CheckCircle2, Clock3, MessageCircle,
  PackageCheck, Printer, Receipt, Shirt, WashingMachine, Wind,
} from 'lucide-react';
import { useCurrentUser } from '@/components/AppShell';
import { Badge } from '@/components/ui';
import { getNextOrderStatus, isProductionStage } from '@/lib/laundry-domain';
import type { OrderStatus, PaymentStatus, UserRole } from '@/lib/laundry-domain';

type OrderDetail = {
  id: number;
  invoiceCode: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string | null;
  totalAmount: number;
  rackLocation: string | null;
  pickedUpBy: string | null;
  cancellationReason: string | null;
  notes: string | null;
  estimatedDone: string | null;
  createdAt: string;
  customer: { id: number; name: string; phone: string };
  createdBy: { name: string; role: UserRole } | null;
  items: {
    id: number;
    serviceName: string;
    unitCode: 'PER_KG' | 'PER_PCS' | 'PER_M2';
    rateType: 'REGULAR' | 'EXPRESS';
    speedName: string;
    quantity: number;
    price: number;
    subtotal: number;
    durationHrs: number;
    workflowStages: string;
  }[];
  payments: { id: number; amount: number; method: string; paidAt: string; staff: { name: string } | null }[];
  statusLogs: { id: number; fromStatus: OrderStatus | null; toStatus: OrderStatus; isUndo: boolean; changedAt: string; staff: { name: string } | null }[];
  complaints: { id: number; type: string; notes: string; status: string; createdAt: string; handledBy: { name: string } | null }[];
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
  { value: 'CANCELLED', label: 'Dibatalkan', icon: AlertCircle },
];
const units = { PER_KG: 'kg', PER_PCS: 'pcs', PER_M2: 'm²' } as const;
const money = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
const dateTime = (value: string) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value));
const methodLabels: Record<string, string> = { CASH: 'Tunai', TRANSFER: 'Transfer', QRIS: 'QRIS' };
const complaintLabels: Record<string, string> = { COLOR_BLEEDING: 'Luntur', LOST: 'Hilang', DAMAGED: 'Rusak', OTHER: 'Lainnya' };

export default function OrderDetailClient({ orderId }: { orderId: string }) {
  const user = useCurrentUser();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [savingStatus, setSavingStatus] = useState(false);
  const [undoLogId, setUndoLogId] = useState<number | null>(null);
  const undoTimer = useRef<number | null>(null);
  const autoPrintHandled = useRef(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [rackLocation, setRackLocation] = useState('');
  const [verifiedInvoiceCode, setVerifiedInvoiceCode] = useState('');
  const [pickedUpBy, setPickedUpBy] = useState('');
  const [allowUnpaid, setAllowUnpaid] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER' | 'QRIS'>('CASH');
  const [complaintType, setComplaintType] = useState('OTHER');
  const [complaintNotes, setComplaintNotes] = useState('');
  const [complaintError, setComplaintError] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');

  const reload = useCallback(async () => {
    try {
      const response = await fetch(`/api/orders/${orderId}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal memuat detail pesanan.');
      setOrder(result as OrderDetail);
      setRackLocation(result.rackLocation ?? '');
      const paid = (result.payments as OrderDetail['payments']).reduce((sum, payment) => sum + payment.amount, 0);
      setPaymentAmount(String(Math.max(0, result.totalAmount - paid)));
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tidak dapat terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(timer);
  }, [reload, retry]);

  useEffect(() => () => {
    if (undoTimer.current !== null) window.clearTimeout(undoTimer.current);
  }, []);

  useEffect(() => {
    if (loading || !order || autoPrintHandled.current) return;
    if (new URLSearchParams(window.location.search).get('print') !== 'invoice') return;
    autoPrintHandled.current = true;
    window.history.replaceState({}, '', window.location.pathname);
    const printTimer = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(printTimer);
  }, [loading, order]);

  const paidAmount = useMemo(() => order?.payments.reduce((sum, payment) => sum + payment.amount, 0) ?? 0, [order]);
  const remaining = order ? Math.max(0, order.totalAmount - paidAmount) : 0;
  const workflowStages = order
    ? [...new Set(order.items.flatMap((item) => item.workflowStages.split(',').filter(isProductionStage)))]
    : [];
  const nextStatus = order ? getNextOrderStatus(order.status, workflowStages) : null;
  const role = user.role;
  const isOwnerOrSuper = role === 'SUPER_OWNER' || role === 'OWNER';
  const canChangeNextStatus = isOwnerOrSuper ||
    (role === 'WASHER' && ['WASHING', 'DRYING', 'IRONING', 'PACKAGED'].includes(nextStatus ?? '')) ||
    (role === 'CASHIER' && ['QUEUED', 'READY', 'COMPLETED'].includes(nextStatus ?? ''));
  const canTakePayment = isOwnerOrSuper || role === 'CASHIER';
  const canManageComplaints = isOwnerOrSuper || role === 'CASHIER';

  async function updateStatus(status: OrderStatus) {
    if (!order) return;
    setError('');
    if (status === 'CANCELLED' && !window.confirm('Batalkan pesanan ini? Tindakan ini tidak dapat dibatalkan.')) return;
    if (status === 'COMPLETED' && !window.confirm('Konfirmasi identitas pengambil dan serah-terima cucian?')) return;
    setSavingStatus(true);
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          ...(status === 'CANCELLED' ? { cancellationReason } : {}),
          ...(['PACKAGED', 'READY'].includes(status) ? { rackLocation } : {}),
          ...(status === 'COMPLETED' ? {
            verifiedInvoiceCode,
            pickedUpBy,
            allowUnpaid,
          } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal memperbarui status.');
      setOrder(result as OrderDetail);
      if (undoTimer.current !== null) window.clearTimeout(undoTimer.current);
      const latestLog = (result as OrderDetail).statusLogs.at(-1);
      const undoTimeLeft = latestLog
        ? 8_000 - (Date.now() - new Date(latestLog.changedAt).getTime())
        : 0;
      if (latestLog && undoTimeLeft > 0 && !['COMPLETED', 'CANCELLED'].includes(status)) {
        setUndoLogId(latestLog.id);
        undoTimer.current = window.setTimeout(() => setUndoLogId(null), undoTimeLeft);
      } else {
        setUndoLogId(null);
      }
      setVerifiedInvoiceCode('');
      setPickedUpBy('');
      setAllowUnpaid(false);
      setCancellationReason('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tidak dapat terhubung ke server.');
    } finally {
      setSavingStatus(false);
    }
  }

  async function undoStatusChange() {
    if (!order || undoLogId === null) return;
    setSavingStatus(true);
    setError('');
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ undoStatusLogId: undoLogId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Status tidak dapat diurungkan.');
      setOrder(result as OrderDetail);
      setUndoLogId(null);
      if (undoTimer.current !== null) window.clearTimeout(undoTimer.current);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tidak dapat terhubung ke server.');
      setUndoLogId(null);
    } finally {
      setSavingStatus(false);
    }
  }

  async function addPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!order || !canTakePayment) return;
    setSavingPayment(true);
    setError('');
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment: { amount: Number(paymentAmount), method: paymentMethod } }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal mencatat pembayaran.');
      setOrder(result as OrderDetail);
      const paid = (result.payments as OrderDetail['payments']).reduce((sum, payment) => sum + payment.amount, 0);
      setPaymentAmount(String(Math.max(0, result.totalAmount - paid)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tidak dapat terhubung ke server.');
    } finally {
      setSavingPayment(false);
    }
  }

  async function addComplaint(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!order) return;
    setComplaintError('');
    try {
      const response = await fetch(`/api/orders/${order.id}/complaints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: complaintType, notes: complaintNotes }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal mencatat komplain.');
      setComplaintNotes('');
      await reload();
    } catch (caught) {
      setComplaintError(caught instanceof Error ? caught.message : 'Tidak dapat terhubung ke server.');
    }
  }

  async function updateComplaint(complaintId: number, status: string) {
    if (!order) return;
    setComplaintError('');
    try {
      const response = await fetch(`/api/orders/${order.id}/complaints/${complaintId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal memperbarui komplain.');
      await reload();
    } catch (caught) {
      setComplaintError(caught instanceof Error ? caught.message : 'Tidak dapat terhubung ke server.');
    }
  }

  function sendReceipt() {
    if (!order) return;
    const lines = [
      '*NOTA LAUNDRY*',
      `Invoice: ${order.invoiceCode}`,
      `Pelanggan: ${order.customer.name}`,
      ...order.items.map((item) => `${item.serviceName} (${item.speedName || (item.rateType === 'EXPRESS' ? 'Express' : 'Reguler')}) - ${item.quantity} ${units[item.unitCode]} x ${money(item.price)} = ${money(item.subtotal)}`),
      `Total: ${money(order.totalAmount)}`,
      `Sudah dibayar: ${money(paidAmount)}`,
      `Sisa tagihan: ${money(remaining)}`,
      `Estimasi: ${order.estimatedDone ? dateTime(order.estimatedDone) : '-'}`,
      ...(order.status === 'COMPLETED' ? [`Diserahkan kepada: ${order.pickedUpBy || '-'}`] : []),
      ...(order.status === 'READY' ? [`Lokasi rak: ${order.rackLocation || '-'}`, 'Cucian siap diambil.'] : []),
    ];
    const phone = order.customer.phone.replace(/\D/g, '').replace(/^0/, '62');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener,noreferrer');
  }

  if (loading) return <div aria-label="Memuat detail pesanan" className="space-y-3"><div className="h-10 animate-pulse bg-neutral-200" /><div className="h-48 animate-pulse bg-neutral-200" /></div>;
  if (error && !order) return <div role="alert" className="rounded-[var(--radius-control)] border border-red-300 bg-white p-6"><p className="text-sm text-red-900">{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-4 min-h-11 border border-neutral-400 px-4 text-sm">Coba lagi</button></div>;
  if (!order) return null;

  const currentStatusLabel = statuses.find((item) => item.value === order.status)?.label ?? order.status;
  const CurrentStatusIcon = statuses.find((item) => item.value === order.status)?.icon ?? Receipt;
  const statusTone = order.status === 'READY' ? 'success' : order.status === 'CANCELLED' ? 'danger' : 'neutral';
  const paymentTone = order.paymentStatus === 'PAID' ? 'success' : 'warning';
  const handoverLog = [...order.statusLogs].reverse().find((log) => log.toStatus === 'COMPLETED');

  return (
    <div className="space-y-6">
      <section id="laundry-print-receipt" className="hidden print:block">
        <div className="receipt">
          <header className="receipt-header">
            <h1>LaundryPOS</h1>
            <p>{order.status === 'COMPLETED' ? 'Bukti pengambilan cucian' : 'Nota transaksi laundry'}</p>
          </header>
          <div className="receipt-meta">
            <p><strong>Invoice</strong><span>{order.invoiceCode}</span></p>
            <p><strong>Pelanggan</strong><span>{order.customer.name}</span></p>
            <p><strong>Nomor telepon</strong><span>{order.customer.phone}</span></p>
            <p><strong>Tanggal transaksi</strong><span>{dateTime(order.createdAt)}</span></p>
            <p><strong>Estimasi selesai</strong><span>{order.estimatedDone ? dateTime(order.estimatedDone) : 'Belum ditentukan'}</span></p>
            {order.status === 'READY' && <p><strong>Lokasi rak</strong><span>{order.rackLocation || 'Belum diisi'}</span></p>}
            {order.status === 'COMPLETED' && (
              <>
                <p><strong>Diserahkan kepada</strong><span>{order.pickedUpBy || '-'}</span></p>
                <p><strong>Waktu pengambilan</strong><span>{handoverLog ? dateTime(handoverLog.changedAt) : '-'}</span></p>
              </>
            )}
          </div>
          <table className="receipt-items">
            <thead><tr><th>Layanan</th><th>Jumlah</th><th>Tarif</th><th>Subtotal</th></tr></thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.serviceName}<br />{item.speedName || (item.rateType === 'EXPRESS' ? 'Express' : 'Reguler')}</td>
                  <td>{item.quantity} {units[item.unitCode]}</td>
                  <td>{money(item.price)}</td>
                  <td>{money(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="receipt-totals">
            <p><strong>Total</strong><strong>{money(order.totalAmount)}</strong></p>
            <p><span>Sudah dibayar</span><span>{money(paidAmount)}</span></p>
            <p><strong>Sisa tagihan</strong><strong>{money(remaining)}</strong></p>
          </div>
          {order.notes && <p className="receipt-note"><strong>Catatan:</strong> {order.notes}</p>}
          {order.status === 'READY' && <p className="receipt-ready">Cucian siap diambil. Mohon tunjukkan invoice ini.</p>}
          <p className="receipt-footer">Terima kasih telah menggunakan layanan kami.</p>
        </div>
      </section>
      <Link href="/orders" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-cyan-900 hover:underline"><ArrowLeft size={20} />Kembali ke pesanan</Link>
      {error && <div role="alert" className="border border-red-300 bg-red-50 p-4 text-sm text-red-900">{error}</div>}
      {undoLogId !== null && <div role="status" className="flex flex-wrap items-center justify-between gap-3 border border-cyan-300 bg-cyan-50 p-3 text-sm text-cyan-950"><span>Status berhasil diperbarui.</span><button type="button" disabled={savingStatus} onClick={() => void undoStatusChange()} className="min-h-11 border border-cyan-800 bg-white px-4 font-semibold text-cyan-950 hover:bg-cyan-100 disabled:opacity-50">Urungkan</button></div>}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-300 pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-600">Detail pesanan</p>
          <h1 className="mt-1 text-2xl font-semibold tabular-nums">{order.invoiceCode}</h1>
          <p className="mt-1 text-sm text-neutral-700">Diterima {dateTime(order.createdAt)} · oleh {order.createdBy?.name ?? 'Petugas sebelumnya'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge icon={CurrentStatusIcon} tone={statusTone}>{currentStatusLabel}</Badge>
          <Badge icon={Banknote} tone={paymentTone}>{order.paymentStatus === 'PAID' ? 'Lunas' : order.paymentStatus === 'PARTIAL' ? 'DP' : 'Belum bayar'}</Badge>
          <button type="button" onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-2 border border-neutral-400 bg-white px-3 text-sm font-medium hover:bg-neutral-100">
            <Printer size={16} />{order.status === 'COMPLETED' ? 'Cetak bukti pengambilan' : 'Cetak invoice'}
          </button>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <div className="space-y-6">
          <section className="rounded-[var(--radius-control)] border border-neutral-200 bg-white p-4 sm:p-6">
            <h2 className="text-xl font-semibold">Ringkasan cucian</h2>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <p><span className="block text-xs text-neutral-600">Pelanggan</span>{order.customer.name}</p>
              <p><span className="block text-xs text-neutral-600">Telepon</span>{order.customer.phone}</p>
              <p><span className="block text-xs text-neutral-600">Estimasi selesai</span>{order.estimatedDone ? dateTime(order.estimatedDone) : 'Belum ditentukan'}</p>
              <p><span className="block text-xs text-neutral-600">Lokasi rak</span>{order.rackLocation || 'Belum diisi'}</p>
            </div>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-y border-neutral-300 bg-neutral-100 text-xs font-semibold uppercase text-neutral-700"><tr><th className="px-3 py-3">Layanan</th><th className="px-3 py-3">Jumlah</th><th className="px-3 py-3 text-right">Tarif</th><th className="px-3 py-3 text-right">Subtotal</th></tr></thead>
                <tbody className="divide-y divide-neutral-200">
                  {order.items.map((item) => <tr key={item.id}><td className="px-3 py-3">{item.serviceName} <span className="text-xs text-neutral-600">({item.speedName || (item.rateType === 'EXPRESS' ? 'Express' : 'Reguler')})</span></td><td className="px-3 py-3 tabular-nums">{item.quantity} {units[item.unitCode]}</td><td className="px-3 py-3 text-right tabular-nums">{money(item.price)}</td><td className="px-3 py-3 text-right font-medium tabular-nums">{money(item.subtotal)}</td></tr>)}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-between border-t border-neutral-300 pt-4 text-xl font-semibold"><span>Total</span><span className="tabular-nums">{money(order.totalAmount)}</span></div>
            {order.notes && <p className="mt-4 border-l-2 border-neutral-400 pl-3 text-sm text-neutral-700">Catatan: {order.notes}</p>}
            {order.cancellationReason && <p className="mt-3 border-l-2 border-red-700 pl-3 text-sm text-red-900">Alasan pembatalan: {order.cancellationReason}</p>}
            {order.pickedUpBy && <p className="mt-3 text-sm text-neutral-700">Diserahkan kepada: {order.pickedUpBy}</p>}
          </section>

          <section className="rounded-[var(--radius-control)] border border-neutral-200 bg-white p-4 sm:p-6">
            <h2 className="text-xl font-semibold">Timeline cucian</h2>
            <ol className="mt-4 space-y-0">
              {order.statusLogs.map((log) => {
                const StatusIcon = statuses.find((item) => item.value === log.toStatus)?.icon ?? Receipt;
                const statusLabel = statuses.find((item) => item.value === log.toStatus)?.label ?? log.toStatus;
                return (
                  <li key={log.id} className="relative flex gap-3 border-l border-neutral-300 pb-6 pl-6 last:border-l-transparent last:pb-0">
                    <span className="absolute -left-[7px] top-1 h-3 w-3 border border-cyan-800 bg-white" />
                    <div>
                      <p className="flex items-center gap-2 text-sm font-semibold"><StatusIcon size={16} />{log.isUndo ? `Dikembalikan ke ${statusLabel}` : statusLabel}</p>
                      <p className="mt-1 text-xs text-neutral-600">{dateTime(log.changedAt)} · {log.staff?.name ?? 'Data migrasi'}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="rounded-[var(--radius-control)] border border-neutral-200 bg-white p-4 sm:p-6">
            <h2 className="text-xl font-semibold">Komplain</h2>
            {complaintError && <p role="alert" className="mt-3 text-sm text-red-900">{complaintError}</p>}
            {order.complaints.length > 0 && (
              <ul className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200">
                {order.complaints.map((complaint) => (
                  <li key={complaint.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div><p className="font-medium">{complaintLabels[complaint.type] ?? complaint.type}</p><p className="mt-1 text-sm text-neutral-700">{complaint.notes}</p><p className="mt-1 text-xs text-neutral-600">{dateTime(complaint.createdAt)}{complaint.handledBy ? ` · ditangani ${complaint.handledBy.name}` : ''}</p></div>
                    {canManageComplaints ? (
                      <select aria-label={`Status komplain ${complaintLabels[complaint.type]}`} value={complaint.status} onChange={(event) => void updateComplaint(complaint.id, event.target.value)} className="min-h-11 border border-neutral-400 bg-white px-2 text-sm">
                        <option value="OPEN">Terbuka</option><option value="IN_PROGRESS">Ditangani</option><option value="RESOLVED">Selesai</option>
                      </select>
                    ) : <p className="text-sm text-neutral-700">{complaint.status === 'OPEN' ? 'Terbuka' : complaint.status === 'IN_PROGRESS' ? 'Ditangani' : 'Selesai'}</p>}
                  </li>
                ))}
              </ul>
            )}
            {['SUPER_OWNER', 'OWNER', 'CASHIER'].includes(role) && (
              <form onSubmit={addComplaint} className="mt-4 grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)_auto]">
                <label className="text-sm font-medium">Jenis komplain
                  <select value={complaintType} onChange={(event) => setComplaintType(event.target.value)} className="mt-1 min-h-11 w-full border border-neutral-400 bg-white px-2 text-sm">
                    <option value="COLOR_BLEEDING">Luntur</option><option value="LOST">Hilang</option><option value="DAMAGED">Rusak</option><option value="OTHER">Lainnya</option>
                  </select>
                </label>
                <label className="text-sm font-medium">Catatan
                  <input required value={complaintNotes} onChange={(event) => setComplaintNotes(event.target.value)} className="mt-1 min-h-11 w-full border border-neutral-400 px-3 text-base" placeholder="Jelaskan masalah" />
                </label>
                <button type="submit" className="mt-4 min-h-11 border border-neutral-400 px-4 text-sm font-medium hover:bg-neutral-100">Catat</button>
              </form>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="space-y-4 rounded-[var(--radius-control)] border border-neutral-200 bg-white p-4 sm:p-6">
            <div>
              <h2 className="text-xl font-semibold">Proses berikutnya</h2>
              <p className="mt-1 text-sm text-neutral-600">Tahap ditentukan dari layanan pada transaksi.</p>
            </div>
            {nextStatus && canChangeNextStatus && (
              <div className="space-y-3">
                {['PACKAGED', 'READY'].includes(nextStatus) && (
                  <label className="block text-sm font-medium">Lokasi rak
                    <input required maxLength={32} value={rackLocation} onChange={(event) => setRackLocation(event.target.value)} className="mt-1 min-h-11 w-full border border-neutral-400 px-3 text-base" placeholder="Contoh: A-03" />
                  </label>
                )}
                {nextStatus === 'COMPLETED' && (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium">Kode invoice verifikasi
                      <input value={verifiedInvoiceCode} onChange={(event) => setVerifiedInvoiceCode(event.target.value)} className="mt-1 min-h-11 w-full border border-neutral-400 px-3 text-base" />
                    </label>
                    <label className="block text-sm font-medium">Atau nama pengambil
                      <input value={pickedUpBy} onChange={(event) => setPickedUpBy(event.target.value)} className="mt-1 min-h-11 w-full border border-neutral-400 px-3 text-base" />
                    </label>
                    {remaining > 0 && isOwnerOrSuper && (
                      <label className="flex min-h-11 items-center gap-2 text-sm">
                        <input type="checkbox" checked={allowUnpaid} onChange={(event) => setAllowUnpaid(event.target.checked)} />
                        Izinkan serah-terima dengan sisa tagihan {money(remaining)}
                      </label>
                    )}
                  </div>
                )}
                <button type="button" disabled={savingStatus} onClick={() => void updateStatus(nextStatus)} className="min-h-11 w-full bg-cyan-800 px-4 text-sm font-semibold text-white hover:bg-cyan-900 disabled:opacity-50">
                  {savingStatus ? 'Menyimpan...' : `Lanjut ke ${statuses.find((item) => item.value === nextStatus)?.label}`}
                </button>
              </div>
            )}
            {!nextStatus && <p className="text-sm text-neutral-600">{order.status === 'CANCELLED' ? 'Pesanan telah dibatalkan.' : 'Pesanan telah selesai.'}</p>}
            {nextStatus && !canChangeNextStatus && <p className="text-sm text-neutral-600">Peran Anda tidak dapat mengubah status ke tahap berikutnya.</p>}
            {isOwnerOrSuper && !['COMPLETED', 'CANCELLED'].includes(order.status) && (
              <div className="space-y-2 border-t border-neutral-200 pt-4">
                <label className="block text-sm font-medium">Alasan pembatalan
                  <input value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} className="mt-1 min-h-11 w-full border border-neutral-400 px-3 text-base" />
                </label>
                <button type="button" disabled={!cancellationReason.trim() || savingStatus} onClick={() => void updateStatus('CANCELLED')} className="min-h-11 border border-red-700 px-4 text-sm font-semibold text-red-900 hover:bg-red-50 disabled:opacity-50">Batalkan pesanan</button>
              </div>
            )}
          </section>

          <section className="space-y-4 rounded-[var(--radius-control)] border border-neutral-200 bg-white p-4 sm:p-6">
            <div>
              <h2 className="text-xl font-semibold">Riwayat pembayaran</h2>
              <p className="mt-1 text-sm text-neutral-700">Dibayar {money(paidAmount)} · sisa {money(remaining)}</p>
            </div>
            {order.payments.length ? (
              <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
                {order.payments.map((payment) => (
                  <li key={payment.id} className="flex justify-between gap-3 py-3 text-sm">
                    <span>{dateTime(payment.paidAt)}<span className="mt-1 block text-xs text-neutral-600">{methodLabels[payment.method] ?? payment.method} · {payment.staff?.name ?? 'Data migrasi'}</span></span>
                    <span className="font-semibold tabular-nums">{money(payment.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-neutral-600">Belum ada pembayaran.</p>}
            {canTakePayment && remaining > 0 && (
              <form onSubmit={addPayment} className="space-y-3 border-t border-neutral-200 pt-4">
                <label className="block text-sm font-medium">Terima pembayaran (Rp)
                  <input type="number" min="1" max={remaining} step="1" required value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} className="mt-1 min-h-11 w-full border border-neutral-400 px-3 text-base tabular-nums" />
                </label>
                <label className="block text-sm font-medium">Metode
                  <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as 'CASH' | 'TRANSFER' | 'QRIS')} className="mt-1 min-h-11 w-full border border-neutral-400 bg-white px-3 text-base">
                    <option value="CASH">Tunai</option><option value="TRANSFER">Transfer</option><option value="QRIS">QRIS</option>
                  </select>
                </label>
                <button type="submit" disabled={savingPayment} className="min-h-11 w-full border border-cyan-800 px-4 text-sm font-semibold text-cyan-900 hover:bg-cyan-50 disabled:opacity-50">{savingPayment ? 'Menyimpan...' : 'Catat pembayaran'}</button>
              </form>
            )}
          </section>

          {role !== 'WASHER' && <button type="button" onClick={sendReceipt} className="flex min-h-11 w-full items-center justify-center gap-2 border border-neutral-400 bg-white px-4 text-sm font-medium hover:bg-neutral-100"><MessageCircle size={20} />Kirim nota WhatsApp</button>}
        </aside>
      </div>
    </div>
  );
}
