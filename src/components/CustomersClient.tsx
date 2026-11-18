'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Calendar, ChevronLeft, ChevronRight, Pencil, Plus, Search, X } from 'lucide-react';
import { Button, Dialog, Input, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui';

type Customer = {
  id: number;
  name: string;
  phone: string;
  address: string | null;
  updatedAt: string;
  _count: { orders: number };
};

export default function CustomersClient() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const response = await fetch(`/api/customers?${params.toString()}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal memuat pelanggan.');
      setCustomers(result as Customer[]);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tidak dapat terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }, [search, startDate, endDate]);

  useEffect(() => {
    setPage(1);
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh, retry]);

  function startCreate() {
    setFormOpen(true);
    setEditing(null);
    setName('');
    setPhone('');
    setAddress('');
    setFormError('');
  }

  function startEdit(customer: Customer) {
    setFormOpen(true);
    setEditing(customer);
    setName(customer.name);
    setPhone(customer.phone);
    setAddress(customer.address ?? '');
    setFormError('');
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const response = await fetch(editing ? `/api/customers/${editing.id}` : '/api/customers', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, address: address || null }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal menyimpan pelanggan.');
      setEditing(null);
      setFormOpen(false);
      await refresh();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Tidak dapat terhubung ke server.');
    } finally {
      setSaving(false);
    }
  }

  function clearDateFilter() {
    setStartDate('');
    setEndDate('');
  }

  const totalPages = Math.ceil(customers.length / ITEMS_PER_PAGE) || 1;
  const paginatedCustomers = customers.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Pelanggan</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Data pelanggan tersimpan berdasarkan nomor telepon.
          </p>
        </div>
        <Button type="button" variant="primary" onClick={startCreate}>
          <Plus size={20} />
          Tambah pelanggan
        </Button>
      </header>

      {formOpen ? (
        <Dialog open={formOpen} title={editing ? 'Ubah pelanggan' : 'Pelanggan baru'} onClose={() => { setEditing(null); setFormOpen(false); setFormError(''); }}>
          {formError && <p role="alert" className="mb-4 text-sm text-red-900 dark:text-red-300">{formError}</p>}
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">Nama
              <Input required value={name} onChange={(event) => setName(event.target.value)} className="mt-1" />
            </label>
            <label className="text-sm font-medium">Nomor telepon
              <Input required type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1" />
            </label>
            <label className="text-sm font-medium sm:col-span-2">Alamat (opsional)
              <textarea rows={2} value={address} onChange={(event) => setAddress(event.target.value)} className="mt-1 w-full rounded-[var(--radius-control)] border border-neutral-400 bg-white p-3 text-base text-neutral-900 outline-none focus:border-cyan-800 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-cyan-500" />
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan pelanggan'}</Button>
              <Button type="button" onClick={() => { setEditing(null); setFormOpen(false); setFormError(''); }}>Batal</Button>
            </div>
          </form>
        </Dialog>
      ) : null}

      {error && (
        <div role="alert" className="flex items-center gap-3 border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300">
          <AlertCircle size={20} />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setRetry((value) => value + 1)} className="min-h-11 border border-red-400 px-3 dark:border-red-700">
            Coba lagi
          </button>
        </div>
      )}

      <section className="space-y-4">
        {/* Search and Date Range Filter Bar */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block flex-1 max-w-md">
            <span className="sr-only">Cari pelanggan</span>
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 dark:text-neutral-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama atau nomor telepon"
              className="pl-10 text-sm"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            <div className="flex items-center gap-1.5 rounded-[var(--radius-control)] border border-neutral-300 bg-white px-2.5 py-1.5 dark:border-neutral-700 dark:bg-neutral-900">
              <Calendar size={15} className="text-cyan-700 dark:text-cyan-400" />
              <label htmlFor="customer-start-date" className="text-xs text-neutral-600 dark:text-neutral-400">Mulai:</label>
              <input
                id="customer-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-xs font-medium text-neutral-800 outline-none dark:text-neutral-200"
              />
            </div>
            <div className="flex items-center gap-1.5 rounded-[var(--radius-control)] border border-neutral-300 bg-white px-2.5 py-1.5 dark:border-neutral-700 dark:bg-neutral-900">
              <label htmlFor="customer-end-date" className="text-xs text-neutral-600 dark:text-neutral-400">Sampai:</label>
              <input
                id="customer-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs font-medium text-neutral-800 outline-none dark:text-neutral-200"
              />
            </div>
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={clearDateFilter}
                className="inline-flex min-h-9 items-center gap-1 rounded-[var(--radius-control)] border border-neutral-300 bg-neutral-100 px-2.5 text-xs text-neutral-700 hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
              >
                <X size={13} />
                Reset Tanggal
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div aria-label="Memuat pelanggan" className="space-y-2">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-14 animate-pulse rounded-[var(--radius-control)] bg-neutral-200 dark:bg-neutral-800" />
            ))}
          </div>
        ) : error && customers.length === 0 ? null : customers.length === 0 ? (
          <div className="rounded-[var(--radius-control)] border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">
              {search || startDate || endDate ? 'Pelanggan tidak ditemukan' : 'Belum ada data pelanggan'}
            </h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {search || startDate || endDate
                ? 'Coba sesuaikan kata kunci pencarian atau filter rentang tanggal.'
                : 'Pelanggan baru juga tersimpan otomatis saat transaksi dibuat.'}
            </p>
            {!search && !startDate && !endDate && (
              <Button type="button" onClick={startCreate} className="mt-4">
                Tambah pelanggan
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-control)] border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <div className="overflow-x-auto">
              <Table>
                <TableHead>
                  <tr>
                    <TableHeaderCell>Pelanggan</TableHeaderCell>
                    <TableHeaderCell>Nomor telepon</TableHeaderCell>
                    <TableHeaderCell>Jumlah pesanan</TableHeaderCell>
                    <TableHeaderCell>Alamat</TableHeaderCell>
                    <TableHeaderCell>Aksi</TableHeaderCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {paginatedCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {customer.name}
                      </TableCell>
                      <TableCell>{customer.phone}</TableCell>
                      <TableCell className="tabular-nums font-medium text-neutral-800 dark:text-neutral-200">
                        {customer._count.orders}
                      </TableCell>
                      <TableCell className="max-w-64 truncate text-neutral-700 dark:text-neutral-300">
                        {customer.address || '-'}
                      </TableCell>
                      <TableCell>
                        <Button type="button" onClick={() => startEdit(customer)} className="min-h-9 px-3 text-xs">
                          <Pencil size={14} />
                          Ubah
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {customers.length > 0 && (
              <div className="flex flex-col items-center justify-between gap-3 border-t border-neutral-200 bg-neutral-50/50 px-4 py-3 sm:flex-row dark:border-neutral-800 dark:bg-neutral-900/50">
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  Menampilkan <span className="font-semibold text-neutral-900 dark:text-neutral-100">{(page - 1) * ITEMS_PER_PAGE + 1}</span> - <span className="font-semibold text-neutral-900 dark:text-neutral-100">{Math.min(page * ITEMS_PER_PAGE, customers.length)}</span> dari <span className="font-semibold text-neutral-900 dark:text-neutral-100">{customers.length}</span> pelanggan
                </p>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      aria-label="Halaman pelanggan sebelumnya"
                      className="flex h-8 w-8 items-center justify-center rounded border border-neutral-300 bg-white text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="px-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      {page} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      aria-label="Halaman pelanggan selanjutnya"
                      className="flex h-8 w-8 items-center justify-center rounded border border-neutral-300 bg-white text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
