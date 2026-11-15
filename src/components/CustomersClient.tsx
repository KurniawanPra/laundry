'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Pencil, Plus, Search } from 'lucide-react';
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
      const response = await fetch(`/api/customers?search=${encodeURIComponent(search)}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal memuat pelanggan.');
      setCustomers(result as Customer[]);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tidak dapat terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
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

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Pelanggan</h1>
          <p className="mt-1 text-sm text-neutral-600">Data pelanggan tersimpan berdasarkan nomor telepon.</p>
        </div>
        <Button type="button" variant="primary" onClick={startCreate}><Plus size={20} />Tambah pelanggan</Button>
      </header>

      {formOpen ? (
        <Dialog open={formOpen} title={editing ? 'Ubah pelanggan' : 'Pelanggan baru'} onClose={() => { setEditing(null); setFormOpen(false); setFormError(''); }}>
          {formError && <p role="alert" className="mb-4 text-sm text-red-900">{formError}</p>}
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">Nama
              <Input required value={name} onChange={(event) => setName(event.target.value)} className="mt-1" />
            </label>
            <label className="text-sm font-medium">Nomor telepon
              <Input required type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1" />
            </label>
            <label className="text-sm font-medium sm:col-span-2">Alamat (opsional)
              <textarea rows={2} value={address} onChange={(event) => setAddress(event.target.value)} className="mt-1 w-full rounded-[var(--radius-control)] border border-neutral-400 p-3 text-base" />
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan pelanggan'}</Button>
              <Button type="button" onClick={() => { setEditing(null); setFormOpen(false); setFormError(''); }}>Batal</Button>
            </div>
          </form>
        </Dialog>
      ) : null}

      {error && <div role="alert" className="flex items-center gap-3 border border-red-300 bg-red-50 p-4 text-sm text-red-900"><AlertCircle size={20} /><span className="flex-1">{error}</span><button type="button" onClick={() => setRetry((value) => value + 1)} className="min-h-11 border border-red-400 px-3">Coba lagi</button></div>}

      <section className="space-y-4">
        <label className="relative block max-w-lg">
          <span className="sr-only">Cari pelanggan</span>
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama atau nomor telepon" className="pl-12" />
        </label>

        {loading ? (
          <div aria-label="Memuat pelanggan" className="space-y-2">{[0, 1, 2].map((row) => <div key={row} className="h-14 animate-pulse bg-neutral-200" />)}</div>
        ) : error && customers.length === 0 ? null : customers.length === 0 ? (
          <div className="rounded-[var(--radius-control)] border border-neutral-200 bg-white p-8 text-center">
            <h2 className="font-semibold">{search ? 'Pelanggan tidak ditemukan' : 'Belum ada data pelanggan'}</h2>
            <p className="mt-1 text-sm text-neutral-600">Pelanggan baru juga tersimpan otomatis saat transaksi dibuat.</p>
            <Button type="button" onClick={startCreate} className="mt-4">Tambah pelanggan</Button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-control)] border border-neutral-200 bg-white">
            <Table>
              <TableHead><tr><TableHeaderCell>Pelanggan</TableHeaderCell><TableHeaderCell>Nomor telepon</TableHeaderCell><TableHeaderCell>Jumlah pesanan</TableHeaderCell><TableHeaderCell>Alamat</TableHeaderCell><TableHeaderCell>Aksi</TableHeaderCell></tr></TableHead>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-semibold">{customer.name}</TableCell>
                    <TableCell>{customer.phone}</TableCell>
                    <TableCell className="tabular-nums">{customer._count.orders}</TableCell>
                    <TableCell className="max-w-64 truncate text-neutral-700">{customer.address || '-'}</TableCell>
                    <TableCell><Button type="button" onClick={() => startEdit(customer)} className="min-h-11 px-3 text-xs"><Pencil size={16} />Ubah</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
