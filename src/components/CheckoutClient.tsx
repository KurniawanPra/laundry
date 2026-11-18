'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Command, LoaderCircle, Plus, Trash2 } from 'lucide-react';

type Service = {
  id: number;
  name: string;
  unitCode: 'PER_KG' | 'PER_PCS' | 'PER_M2';
  regularPrice: number;
  expressPrice: number;
  durationHrs: number;
  expressDurationHrs: number;
  isActive: boolean;
  stages: { stage: string; position: number }[];
};

type Speed = { id: number; name: string; priceMultiplier: number; durationMultiplier: number };
type CartLine = { key: number; serviceId: number; speedId: number; quantity: string };

const units = { PER_KG: 'kg', PER_PCS: 'pcs', PER_M2: 'm²' } as const;
const money = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
const normalizedPhone = (phone: string) => phone.replace(/\D/g, '');

export default function CheckoutClient() {
  const router = useRouter();
  const phoneRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const serviceRef = useRef<HTMLSelectElement>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [speeds, setSpeeds] = useState<Speed[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNameError, setCustomerNameError] = useState('');
  const [customerPhoneError, setCustomerPhoneError] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [lookupMessage, setLookupMessage] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [newServiceId, setNewServiceId] = useState('');
  const [newSpeedId, setNewSpeedId] = useState('');
  const [newQuantity, setNewQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER' | 'QRIS'>('CASH');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const focusTimer = window.setTimeout(() => phoneRef.current?.focus(), 0);
    Promise.all([
      fetch('/api/services', { cache: 'no-store' }),
      fetch('/api/speeds', { cache: 'no-store' }),
    ])
      .then(async ([serviceResponse, speedResponse]) => {
        const [serviceResult, speedResult] = await Promise.all([
          serviceResponse.json(),
          speedResponse.json(),
        ]);
        if (!serviceResponse.ok) throw new Error(serviceResult.error || 'Gagal memuat layanan.');
        if (!speedResponse.ok) throw new Error(speedResult.error || 'Gagal memuat kecepatan laundry.');
        return { services: serviceResult as Service[], speeds: speedResult as Speed[] };
      })
      .then(({ services: loadedServices, speeds: loadedSpeeds }) => {
        setServices(loadedServices);
        setSpeeds(loadedSpeeds);
        setNewServiceId(String(loadedServices[0]?.id ?? ''));
        setNewSpeedId(String(loadedSpeeds[0]?.id ?? ''));
      })
      .catch((caught: unknown) => setServicesError(caught instanceof Error ? caught.message : 'Tidak dapat memuat layanan.'))
      .finally(() => setServicesLoading(false));
    return () => window.clearTimeout(focusTimer);
  }, []);

  const serviceById = useMemo(() => new Map(services.map((service) => [service.id, service])), [services]);
  const speedById = useMemo(() => new Map(speeds.map((speed) => [speed.id, speed])), [speeds]);
  const cartDetails = useMemo(() => cart.map((line) => {
    const service = serviceById.get(line.serviceId);
    const speed = speedById.get(line.speedId);
    const quantity = Number(line.quantity);
    const validQuantity = Number.isFinite(quantity) && quantity > 0;
    const unitPrice = service && speed
      ? Math.round(service.regularPrice * speed.priceMultiplier)
      : 0;
    return {
      ...line,
      service,
      speed,
      quantity,
      validQuantity,
      unitPrice,
      subtotal: validQuantity ? Math.round(quantity * unitPrice) : 0,
    };
  }), [cart, serviceById, speedById]);
  const total = cartDetails.reduce((sum, line) => sum + line.subtotal, 0);
  const paid = Number(paymentAmount) || 0;
  const remaining = Math.max(0, total - paid);

  async function lookupCustomer(moveFocus: boolean) {
    const phone = customerPhone.trim();
    if (normalizedPhone(phone).length < 8 || !/^[0-9+()\-\s]+$/.test(phone)) {
      setLookupMessage('');
      if (moveFocus) {
        setCustomerPhoneError(phone ? 'Masukkan nomor telepon yang valid (minimal 8 angka).' : 'Nomor telepon wajib diisi.');
        nameRef.current?.focus();
      }
      return;
    }
    setCustomerPhoneError('');
    setLookupError('');
    try {
      const response = await fetch(`/api/customers?search=${encodeURIComponent(phone)}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal mencari pelanggan.');
      const customer = (result as { name: string; phone: string; address: string | null }[])
        .find((item) => normalizedPhone(item.phone) === normalizedPhone(phone));
      if (customer) {
        setCustomerName(customer.name);
        setCustomerAddress(customer.address ?? '');
        setLookupMessage('Data pelanggan ditemukan.');
        if (moveFocus) serviceRef.current?.focus();
      } else {
        setCustomerAddress('');
        setLookupMessage('Pelanggan baru. Data akan disimpan setelah transaksi.');
        if (moveFocus) nameRef.current?.focus();
      }
    } catch (caught) {
      setLookupError(caught instanceof Error ? caught.message : 'Gagal mencari pelanggan.');
      if (moveFocus) nameRef.current?.focus();
    }
  }

  function addToCart() {
    const serviceId = Number(newServiceId);
    const service = serviceById.get(serviceId);
    const speedId = Number(newSpeedId);
    const speed = speedById.get(speedId);
    const quantity = Number(newQuantity);
    if (!service || !speed || !Number.isFinite(quantity) || quantity <= 0) {
      setError('Pilih layanan dan kecepatan, lalu masukkan jumlah yang lebih besar dari nol.');
      return;
    }
    setError('');
    setCart((current) => [...current, {
      key: Date.now() + current.length,
      serviceId,
      speedId,
      quantity: String(quantity),
    }]);
    setNewQuantity('1');
  }

  function updateLine(key: number, patch: Partial<CartLine>) {
    setCart((current) => current.map((line) => line.key === key ? { ...line, ...patch } : line));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const invalidPhone = normalizedPhone(customerPhone).length < 8 ||
      !/^[0-9+()\-\s]+$/.test(customerPhone.trim());
    const invalidName = !customerName.trim();
    setCustomerPhoneError(invalidPhone ? 'Masukkan nomor telepon yang valid (minimal 8 angka).' : '');
    setCustomerNameError(invalidName ? 'Nama pelanggan wajib diisi.' : '');
    if (invalidPhone || invalidName) {
      if (invalidPhone) phoneRef.current?.focus();
      else nameRef.current?.focus();
      return;
    }
    if (!cartDetails.length || cartDetails.some((line) => !line.service || !line.speed || !line.validQuantity)) {
      setError('Periksa kembali layanan dan jumlah di keranjang.');
      return;
    }
    if (!Number.isInteger(paid) || paid < 0 || paid > total) {
      setError('Pembayaran awal harus berupa angka rupiah dan tidak boleh melebihi total.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: { name: customerName.trim(), phone: customerPhone.trim() },
          items: cartDetails.map((line) => ({
            serviceId: line.serviceId,
            speedId: line.speedId,
            quantity: line.quantity,
          })),
          notes: notes.trim(),
          ...(paid > 0 ? { initialPayment: { amount: paid, method: paymentMethod } } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Transaksi tidak dapat disimpan.');
      router.push(`/orders/${result.id}?print=invoice`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tidak dapat terhubung ke server.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleFormKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.requestSubmit();
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Transaksi baru</h1>
        <p className="mt-1 text-sm text-neutral-600">Terima cucian, susun layanan, lalu catat pembayaran awal.</p>
        <ol className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-700">
          {['1. Pelanggan', '2. Keranjang cucian', '3. Pembayaran'].map((step) =>           <li key={step} className="rounded-[var(--radius-control)] border border-neutral-300 bg-white px-3 py-2">{step}</li>)}
        </ol>
      </header>

      {error && <div role="alert" className="flex items-start gap-3 border border-red-300 bg-red-50 p-4 text-sm text-red-900"><AlertCircle size={20} /><p>{error}</p></div>}
      {servicesError && <div role="alert" className="border border-red-300 bg-red-50 p-4 text-sm text-red-900">{servicesError}</div>}

      <form onSubmit={submit} onKeyDown={handleFormKeyDown} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
        <div className="space-y-6">
          <section aria-labelledby="customer-heading" className="space-y-4 rounded-[var(--radius-control)] border border-neutral-200 bg-white p-4 sm:p-6">
            <h2 id="customer-heading" className="text-xl font-semibold">1. Data pelanggan</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="customer-phone" className="mb-1 block text-sm font-medium">Nomor telepon / WhatsApp</label>
                <input
                  ref={phoneRef}
                  id="customer-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  aria-invalid={Boolean(customerPhoneError)}
                  value={customerPhone}
                  onChange={(event) => { setCustomerPhone(event.target.value); setLookupMessage(''); setCustomerPhoneError(''); }}
                  onBlur={() => { void lookupCustomer(false); }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void lookupCustomer(true);
                    }
                  }}
                  className="min-h-12 w-full border border-neutral-400 px-3 text-base outline-none focus:border-cyan-800 focus:ring-2 focus:ring-cyan-800/20"
                  placeholder="08xxxxxxxxxx"
                />
                {customerPhoneError && <p role="alert" className="mt-1 text-xs text-red-900">{customerPhoneError}</p>}
                {lookupMessage && <p className="mt-1 text-xs text-neutral-700">{lookupMessage}</p>}
                {lookupError && <p role="alert" className="mt-1 text-xs text-red-800">{lookupError}</p>}
              </div>
              <div>
                <label htmlFor="customer-name" className="mb-1 block text-sm font-medium">Nama pelanggan</label>
                <input ref={nameRef} id="customer-name" autoComplete="name" aria-invalid={Boolean(customerNameError)} value={customerName} onChange={(event) => { setCustomerName(event.target.value); setCustomerNameError(''); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); serviceRef.current?.focus(); } }} className="min-h-12 w-full border border-neutral-400 px-3 text-base outline-none focus:border-cyan-800 focus:ring-2 focus:ring-cyan-800/20" placeholder="Nama lengkap" />
                {customerNameError && <p role="alert" className="mt-1 text-xs text-red-900">{customerNameError}</p>}
              </div>
              {customerAddress && <p className="text-sm text-neutral-600 sm:col-span-2">Alamat tersimpan: {customerAddress}</p>}
            </div>
          </section>

          <section aria-labelledby="basket-heading" className="space-y-4 rounded-[var(--radius-control)] border border-neutral-200 bg-white p-4 sm:p-6">
            <div>
              <h2 id="basket-heading" className="text-xl font-semibold">2. Keranjang cucian</h2>
              <p className="mt-1 text-sm text-neutral-600">Tarif dan layanan yang tercatat di transaksi tidak berubah jika harga master diperbarui.</p>
            </div>
            {servicesLoading ? (
              <div aria-label="Memuat layanan" className="h-12 animate-pulse bg-neutral-200" />
            ) : services.length === 0 ? (
              <p className="border border-neutral-300 bg-neutral-50 p-4 text-sm">Belum ada layanan aktif. Minta Pemilik menambahkan layanan di Master Data.</p>
            ) : speeds.length === 0 ? (
              <p className="border border-neutral-300 bg-neutral-50 p-4 text-sm">Belum ada kecepatan aktif. Minta Pemilik mengaturnya di Master Data.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_112px_160px_auto]">
                <div>
                  <label htmlFor="service-choice" className="mb-1 block text-sm font-medium">Layanan</label>
                  <select ref={serviceRef} id="service-choice" value={newServiceId} onChange={(event) => setNewServiceId(event.target.value)} className="min-h-12 w-full border border-neutral-400 bg-white px-3 text-base">
                    {services.map((service) => <option key={service.id} value={service.id}>{service.name} ({units[service.unitCode]})</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="service-quantity" className="mb-1 block text-sm font-medium">Jumlah</label>
                  <input id="service-quantity" type="number" min="0.1" step="0.1" value={newQuantity} onChange={(event) => setNewQuantity(event.target.value)} className="min-h-12 w-full border border-neutral-400 px-3 text-base" />
                </div>
                <div>
                  <label htmlFor="service-rate" className="mb-1 block text-sm font-medium">Kecepatan</label>
                  <select id="service-rate" value={newSpeedId} onChange={(event) => setNewSpeedId(event.target.value)} className="min-h-12 w-full border border-neutral-400 bg-white px-3 text-base">
                    {speeds.map((speed) => <option key={speed.id} value={speed.id}>{speed.name}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <button type="button" onClick={addToCart} className="flex min-h-12 w-full items-center justify-center gap-2 border border-cyan-800 px-3 text-sm font-semibold text-cyan-900 hover:bg-cyan-50">
                    <Plus size={20} />
                    Tambah
                  </button>
                </div>
              </div>
            )}

            {cartDetails.length === 0 ? (
              <p className="border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-600">Keranjang masih kosong. Tambahkan layanan untuk mulai menghitung tagihan.</p>
            ) : (
              <div className="divide-y divide-neutral-200 border-y border-neutral-200">
                {cartDetails.map((line) => (
                  <div key={line.key} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_112px_140px_44px] sm:items-end">
                    <div className="min-w-0">
                      <p className="font-medium">{line.service?.name}</p>
                      <p className="mt-1 text-xs text-neutral-600">{line.speed?.name} · {money(line.unitPrice)} / {line.service ? units[line.service.unitCode] : ''}</p>
                    </div>
                    <div>
                      <label htmlFor={`quantity-${line.key}`} className="mb-1 block text-xs text-neutral-600">Jumlah</label>
                      <input id={`quantity-${line.key}`} type="number" min="0.1" step="0.1" value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: event.target.value })} className="min-h-11 w-full border border-neutral-400 px-2 text-base" />
                      {!line.validQuantity && <p role="alert" className="mt-1 text-xs text-red-900">Jumlah harus lebih dari nol.</p>}
                    </div>
                    <p className="text-right font-semibold tabular-nums">{money(line.subtotal)}</p>
                    <button type="button" aria-label={`Hapus ${line.service?.name}`} onClick={() => setCart((current) => current.filter((entry) => entry.key !== line.key))} className="flex min-h-11 min-w-11 items-center justify-center border border-neutral-300 text-neutral-700 hover:bg-neutral-100">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div>
              <label htmlFor="order-notes" className="mb-1 block text-sm font-medium">Catatan cucian</label>
              <textarea id="order-notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} className="w-full border border-neutral-400 p-3 text-base" placeholder="Contoh: pisahkan pakaian putih" />
            </div>
          </section>
        </div>

        <aside aria-labelledby="bill-heading" className="sticky bottom-16 space-y-4 rounded-[var(--radius-control)] border border-neutral-300 bg-white p-4 sm:p-6 lg:top-20 lg:bottom-auto">
          <h2 id="bill-heading" className="text-xl font-semibold">3. Ringkasan tagihan</h2>
          <div className="space-y-2 border-b border-neutral-200 pb-4 text-sm">
            <div className="flex justify-between gap-4"><span>Jumlah layanan</span><span className="tabular-nums">{cart.length}</span></div>
            {cartDetails.map((line) => <div key={line.key} className="flex justify-between gap-4 text-neutral-700"><span className="min-w-0 truncate">{line.service?.name} ({line.quantity || 0} {line.service ? units[line.service.unitCode] : ''})</span><span className="shrink-0 tabular-nums">{money(line.subtotal)}</span></div>)}
          </div>
          <div className="flex justify-between gap-4 text-xl font-semibold">
            <span>Total tagihan</span><span className="tabular-nums">{money(total)}</span>
          </div>
          <div>
            <label htmlFor="payment-amount" className="mb-1 block text-sm font-medium">Pembayaran awal (Rp)</label>
            <input id="payment-amount" type="number" min="0" max={total} step="1" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} className="min-h-12 w-full border border-neutral-400 px-3 text-base tabular-nums" />
            {paymentAmount !== '' && (!Number.isInteger(paid) || paid < 0 || paid > total) && <p role="alert" className="mt-1 text-xs text-red-900">Pembayaran harus berupa rupiah utuh dan tidak boleh melebihi total tagihan.</p>}
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => setPaymentAmount('0')} className="min-h-11 border border-neutral-300 px-3 text-xs hover:bg-neutral-100">Tanpa DP</button>
              <button type="button" onClick={() => setPaymentAmount(String(total))} className="min-h-11 border border-neutral-300 px-3 text-xs hover:bg-neutral-100">Bayar lunas</button>
            </div>
          </div>
          {paid > 0 && (
            <div>
              <label htmlFor="payment-method" className="mb-1 block text-sm font-medium">Metode pembayaran</label>
              <select id="payment-method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as 'CASH' | 'TRANSFER' | 'QRIS')} className="min-h-12 w-full border border-neutral-400 bg-white px-3 text-base">
                <option value="CASH">Tunai</option>
                <option value="TRANSFER">Transfer</option>
                <option value="QRIS">QRIS</option>
              </select>
            </div>
          )}
          <div className="flex justify-between border-t border-neutral-200 pt-3 text-sm">
            <span>Sisa tagihan</span><span className="font-semibold tabular-nums">{money(remaining)}</span>
          </div>
          <button type="submit" disabled={submitting || !cartDetails.length || servicesLoading || services.length === 0} className="flex min-h-12 w-full items-center justify-center gap-2 bg-cyan-800 px-4 text-sm font-semibold text-white hover:bg-cyan-900 disabled:cursor-not-allowed disabled:opacity-50">
            {submitting ? <><LoaderCircle size={20} className="animate-spin" /> Menyimpan...</> : 'Simpan transaksi'}
          </button>
          <p className="flex flex-wrap items-center justify-center gap-1.5 text-center text-xs text-neutral-600 dark:text-neutral-400">
            <span>Tekan</span>
            <kbd className="rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">Ctrl</kbd>
            <span>+</span>
            <kbd className="rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">Enter</kbd>
            <span>atau</span>
            <kbd className="inline-flex items-center gap-0.5 rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
              <Command size={10} /> Cmd
            </kbd>
            <span>+</span>
            <kbd className="rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">Enter</kbd>
            <span>untuk menyimpan.</span>
          </p>
        </aside>
      </form>
    </div>
  );
}
