'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle, Building2, CheckCircle2, Edit2, ExternalLink,
  MapPin, Phone, Plus, Search, Store, Users, XCircle,
} from 'lucide-react';
import { Badge, Button, Card, Dialog, Input } from '@/components/ui';

type StoreOwner = {
  id: number;
  name: string;
  email: string;
};

type StoreItem = {
  id: number;
  code: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  isActive: boolean;
  owner?: StoreOwner | null;
  stats?: {
    totalOrders: number;
    activeOrders: number;
    totalCustomers: number;
    totalServices: number;
    totalRevenue: number;
  };
  createdAt: string;
};

type StaffUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
};

const money = (amount: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);

export default function StoresClient() {
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreItem | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Form fields
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [ownerId, setOwnerId] = useState<string>('');
  const [isActive, setIsActive] = useState(true);

  const fetchStores = useCallback(async () => {
    try {
      setLoading(true);
      const [resStores, resStaff] = await Promise.all([
        fetch('/api/stores', { cache: 'no-store' }),
        fetch('/api/staff', { cache: 'no-store' }),
      ]);

      if (!resStores.ok) {
        const err = await resStores.json();
        throw new Error(err.error || 'Gagal memuat daftar toko.');
      }

      const storesData = await resStores.json();
      setStores(storesData);

      if (resStaff.ok) {
        const staffData = await resStaff.json();
        setStaffList(staffData);
      }
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStores();
  }, [fetchStores]);

  function openCreateDialog() {
    setEditingStore(null);
    setCode('');
    setName('');
    setAddress('');
    setPhone('');
    setOwnerId('');
    setIsActive(true);
    setFormError('');
    setDialogOpen(true);
  }

  function openEditDialog(st: StoreItem) {
    setEditingStore(st);
    setCode(st.code);
    setName(st.name);
    setAddress(st.address || '');
    setPhone(st.phone || '');
    setOwnerId(st.owner ? String(st.owner.id) : '');
    setIsActive(st.isActive);
    setFormError('');
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError('');

    try {
      const payload = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        ownerId: ownerId ? Number(ownerId) : null,
        isActive,
      };

      const url = editingStore ? `/api/stores/${editingStore.id}` : '/api/stores';
      const method = editingStore ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Gagal menyimpan data toko.');
      }

      setDialogOpen(false);
      await fetchStores();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal memproses formulir.');
    } finally {
      setFormSubmitting(false);
    }
  }

  async function switchToStore(storeId: number) {
    try {
      const res = await fetch('/api/stores/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId }),
      });
      if (!res.ok) throw new Error('Gagal beralih ke toko ini.');
      window.location.href = '/';
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal beralih ke toko.');
    }
  }

  const filteredStores = stores.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q) ||
      (s.address && s.address.toLowerCase().includes(q)) ||
      (s.owner && s.owner.name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            <Building2 className="text-cyan-700 dark:text-cyan-400" size={28} />
            Kelola Cabang & Toko
          </h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Pusat kendali multi-toko: buat cabang baru, tunjuk pengelola (Owner), dan tinjau metrik cabang.
          </p>
        </div>
        <Button variant="primary" onClick={openCreateDialog} className="shrink-0">
          <Plus size={18} />
          Tambah Cabang Baru
        </Button>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-[var(--radius-control)] border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            placeholder="Cari berdasarkan nama, kode, atau pemilik..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-h-11 w-full rounded-[var(--radius-control)] border border-neutral-300 bg-white pl-9 pr-4 text-sm text-neutral-900 focus:border-cyan-600 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </div>
      </div>

      {/* Loading & Empty States */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-[var(--radius-control)] bg-neutral-200 dark:bg-neutral-800" />
          ))}
        </div>
      ) : filteredStores.length === 0 ? (
        <Card className="p-8 text-center">
          <Store size={36} className="mx-auto text-neutral-400" />
          <h2 className="mt-3 font-semibold text-neutral-900 dark:text-neutral-100">
            {stores.length === 0 ? 'Belum ada cabang terdaftar' : 'Tidak ada cabang yang cocok'}
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {stores.length === 0
              ? 'Tambahkan cabang toko pertama Anda untuk memulai operasional.'
              : 'Coba ubah kata kunci pencarian.'}
          </p>
          {stores.length === 0 && (
            <Button variant="primary" onClick={openCreateDialog} className="mt-4">
              <Plus size={16} /> Tambah Cabang Sekarang
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStores.map((st) => (
            <Card key={st.id} className="flex flex-col justify-between overflow-hidden p-5 transition hover:shadow-md">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="rounded bg-cyan-100 px-2 py-0.5 text-xs font-bold text-cyan-900 dark:bg-cyan-950 dark:text-cyan-300">
                      {st.code}
                    </span>
                    <h2 className="mt-2 text-lg font-bold text-neutral-900 dark:text-neutral-100">
                      {st.name}
                    </h2>
                  </div>
                  {st.isActive ? (
                    <Badge tone="success" icon={CheckCircle2}>Aktif</Badge>
                  ) : (
                    <Badge tone="danger" icon={XCircle}>Nonaktif</Badge>
                  )}
                </div>

                <div className="space-y-1.5 text-xs text-neutral-600 dark:text-neutral-400">
                  {st.address && (
                    <p className="flex items-center gap-1.5 truncate">
                      <MapPin size={14} className="shrink-0 text-cyan-700 dark:text-cyan-400" />
                      <span className="truncate">{st.address}</span>
                    </p>
                  )}
                  {st.phone && (
                    <p className="flex items-center gap-1.5">
                      <Phone size={14} className="shrink-0 text-cyan-700 dark:text-cyan-400" />
                      <span>{st.phone}</span>
                    </p>
                  )}
                  <p className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300">
                    <Users size={14} className="shrink-0 text-cyan-700 dark:text-cyan-400" />
                    <span>Pemilik:</span>
                    <span className="font-semibold">{st.owner?.name ?? 'Belum ditentukan'}</span>
                  </p>
                </div>

                {st.stats && (
                  <div className="grid grid-cols-2 gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
                    <div className="rounded bg-neutral-50 p-2 dark:bg-neutral-800/50">
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Total Omset</p>
                      <p className="text-xs font-bold tabular-nums text-neutral-900 dark:text-neutral-100">
                        {money(st.stats.totalRevenue)}
                      </p>
                    </div>
                    <div className="rounded bg-neutral-50 p-2 dark:bg-neutral-800/50">
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Pesanan Aktif</p>
                      <p className="text-xs font-bold tabular-nums text-neutral-900 dark:text-neutral-100">
                        {st.stats.activeOrders} <span className="text-[10px] font-normal text-neutral-400">/ {st.stats.totalOrders}</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5 flex items-center justify-between gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
                <Button
                  variant="secondary"
                  onClick={() => openEditDialog(st)}
                  className="flex-1 text-xs"
                >
                  <Edit2 size={14} />
                  Edit Cabang
                </Button>
                <Button
                  variant="primary"
                  onClick={() => switchToStore(st.id)}
                  className="flex-1 text-xs"
                >
                  <ExternalLink size={14} />
                  Buka Toko
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Dialog Form */}
      <Dialog
        open={dialogOpen}
        title={editingStore ? `Edit Cabang: ${editingStore.name}` : 'Tambah Cabang Baru'}
        onClose={() => setDialogOpen(false)}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-900 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300">
              {formError}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="store-code" className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Kode Cabang *
              </label>
              <Input
                id="store-code"
                required
                maxLength={10}
                placeholder="mis. PST / BDG"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="mt-1 font-mono uppercase"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="store-name" className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Nama Toko / Cabang *
              </label>
              <Input
                id="store-name"
                required
                maxLength={191}
                placeholder="mis. Laundry Cabang Tebet"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <label htmlFor="store-address" className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              Alamat Lengkap
            </label>
            <Input
              id="store-address"
              placeholder="mis. Jl. Tebet Raya No. 45"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <label htmlFor="store-phone" className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              Nomor Telepon
            </label>
            <Input
              id="store-phone"
              type="tel"
              placeholder="mis. 081234567890"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <label htmlFor="store-owner" className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              Tunjuk Pemilik Cabang (Owner)
            </label>
            <select
              id="store-owner"
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-[var(--radius-control)] border border-neutral-400 bg-white px-3 text-sm text-neutral-900 focus:border-cyan-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            >
              <option value="">-- Belum ada pemilik ditunjuk --</option>
              {staffList
                .filter((stf) => stf.role === 'OWNER' || stf.role === 'SUPER_OWNER')
                .map((stf) => (
                  <option key={stf.id} value={stf.id}>
                    {stf.name} ({stf.email}) - {stf.role}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="store-is-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-400 text-cyan-600 focus:ring-cyan-500"
            />
            <label htmlFor="store-is-active" className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
              Cabang Aktif Beroperasi
            </label>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDialogOpen(false)}
              disabled={formSubmitting}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" disabled={formSubmitting}>
              {formSubmitting ? 'Menyimpan...' : editingStore ? 'Simpan Perubahan' : 'Buat Cabang'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
