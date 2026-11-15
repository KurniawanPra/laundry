'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Pencil, Plus, Save, X } from 'lucide-react';
import { useCurrentUser } from '@/components/AppShell';

type Stage = 'WASHING' | 'DRYING' | 'IRONING';
type UnitCode = 'PER_KG' | 'PER_PCS' | 'PER_M2';
type Service = {
  id: number;
  name: string;
  unitCode: UnitCode;
  regularPrice: number;
  expressPrice: number;
  durationHrs: number;
  expressDurationHrs: number;
  isActive: boolean;
  stages: { stage: Stage }[];
};
type Staff = {
  id: number;
  name: string;
  email: string;
  role: 'OWNER' | 'CASHIER' | 'WASHER';
  isActive: boolean;
};
type AppSettings = { uncollectedReadyDays: number };
type Speed = { id: number; name: string; priceMultiplier: number; durationMultiplier: number; isActive: boolean };
type ServiceForm = Omit<Service, 'id' | 'stages' | 'expressPrice' | 'expressDurationHrs'> & { stages: Stage[] };
type SpeedForm = Omit<Speed, 'id'>;
type SettingsSection = 'settings' | 'services' | 'users' | 'speeds';

const stages: { value: Stage; label: string }[] = [
  { value: 'WASHING', label: 'Dicuci' },
  { value: 'DRYING', label: 'Dikeringkan' },
  { value: 'IRONING', label: 'Disetrika' },
];
const unitLabels: Record<UnitCode, string> = { PER_KG: 'Per kilogram', PER_PCS: 'Per potong', PER_M2: 'Per meter persegi' };
const money = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);

function blankService(): ServiceForm {
  return {
    name: '',
    unitCode: 'PER_KG',
    regularPrice: 0,
    durationHrs: 48,
    isActive: true,
    stages: ['WASHING', 'DRYING', 'IRONING'],
  };
}

export default function SettingsClient({ section = 'settings' }: { section?: SettingsSection }) {
  const currentUser = useCurrentUser();
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [speeds, setSpeeds] = useState<Speed[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ uncollectedReadyDays: 7 });
  const [serviceForm, setServiceForm] = useState<ServiceForm | null>(null);
  const [editingServiceId, setEditingServiceId] = useState<number | null>(null);
  const [speedForm, setSpeedForm] = useState<SpeedForm | null>(null);
  const [editingSpeedId, setEditingSpeedId] = useState<number | null>(null);
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffRole, setStaffRole] = useState<'CASHIER' | 'WASHER'>('CASHIER');
  const [loading, setLoading] = useState(true);
  const [savingService, setSavingService] = useState(false);
  const [savingSpeed, setSavingSpeed] = useState(false);
  const [savingStaff, setSavingStaff] = useState(false);
  const [savingDays, setSavingDays] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formError, setFormError] = useState('');
  const [retry, setRetry] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const [serviceResponse, staffResponse, settingsResponse, speedResponse] = await Promise.all([
        section === 'services' ? fetch('/api/services', { cache: 'no-store' }) : undefined,
        section === 'users' ? fetch('/api/staff', { cache: 'no-store' }) : undefined,
        section === 'settings' ? fetch('/api/settings', { cache: 'no-store' }) : undefined,
        section === 'speeds' ? fetch('/api/speeds', { cache: 'no-store' }) : undefined,
      ]);
      const [serviceResult, staffResult, settingsResult, speedResult] = await Promise.all([
        serviceResponse?.json(), staffResponse?.json(), settingsResponse?.json(), speedResponse?.json(),
      ]);
      if (serviceResponse && !serviceResponse.ok) throw new Error(serviceResult.error || 'Gagal memuat layanan.');
      if (staffResponse && !staffResponse.ok) throw new Error(staffResult.error || 'Gagal memuat staf.');
      if (settingsResponse && !settingsResponse.ok) throw new Error(settingsResult.error || 'Gagal memuat pengaturan.');
      if (speedResponse && !speedResponse.ok) throw new Error(speedResult.error || 'Gagal memuat kecepatan laundry.');
      if (serviceResult) setServices(serviceResult as Service[]);
      if (staffResult) setStaff(staffResult as Staff[]);
      if (settingsResult) setSettings(settingsResult as AppSettings);
      if (speedResult) setSpeeds(speedResult as Speed[]);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tidak dapat terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh, retry]);

  function editService(service: Service | null) {
    setServiceForm(service ? {
      name: service.name,
      unitCode: service.unitCode,
      regularPrice: service.regularPrice,
      durationHrs: service.durationHrs,
      isActive: service.isActive,
      stages: service.stages.map((item) => item.stage),
    } : blankService());
    setEditingServiceId(service?.id ?? null);
    setFormError('');
    setNotice('');
  }

  async function saveService(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!serviceForm) return;
    setSavingService(true);
    setFormError('');
    setNotice('');
    try {
      const response = await fetch(editingServiceId ? `/api/services/${editingServiceId}` : '/api/services', {
        method: editingServiceId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serviceForm),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal menyimpan layanan.');
      setServiceForm(null);
      setEditingServiceId(null);
      setNotice('Layanan berhasil disimpan.');
      await refresh();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Tidak dapat terhubung ke server.');
    } finally {
      setSavingService(false);
    }
  }

  function editSpeed(speed: Speed | null) {
    setSpeedForm(speed ? {
      name: speed.name,
      priceMultiplier: speed.priceMultiplier,
      durationMultiplier: speed.durationMultiplier,
      isActive: speed.isActive,
    } : {
      name: '',
      priceMultiplier: 1,
      durationMultiplier: 1,
      isActive: true,
    });
    setEditingSpeedId(speed?.id ?? null);
    setFormError('');
    setNotice('');
  }

  async function saveSpeed(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!speedForm) return;
    setSavingSpeed(true);
    setFormError('');
    setNotice('');
    try {
      const response = await fetch(editingSpeedId ? `/api/speeds/${editingSpeedId}` : '/api/speeds', {
        method: editingSpeedId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(speedForm),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal menyimpan kecepatan.');
      setSpeedForm(null);
      setEditingSpeedId(null);
      setNotice('Kecepatan laundry berhasil disimpan.');
      await refresh();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Tidak dapat terhubung ke server.');
    } finally {
      setSavingSpeed(false);
    }
  }

  async function updateSpeed(speed: Speed) {
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/speeds/${speed.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !speed.isActive }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal memperbarui kecepatan.');
      setNotice('Status kecepatan berhasil diperbarui.');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tidak dapat terhubung ke server.');
    }
  }

  async function createStaff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingStaff(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: staffName, email: staffEmail, password: staffPassword, role: staffRole }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal membuat akun staf.');
      setStaffName('');
      setStaffEmail('');
      setStaffPassword('');
      setNotice('Akun staf berhasil dibuat.');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tidak dapat terhubung ke server.');
    } finally {
      setSavingStaff(false);
    }
  }

  async function updateStaff(id: number, patch: Partial<Pick<Staff, 'role' | 'isActive'>>) {
    const member = staff.find((item) => item.id === id);
    if (!member) return;
    if (patch.isActive === false && !window.confirm(`Nonaktifkan akun ${member.name}?`)) return;
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/staff/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal memperbarui akun staf.');
      setNotice('Akun staf berhasil diperbarui.');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tidak dapat terhubung ke server.');
    }
  }

  async function saveDays(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingDays(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal menyimpan pengaturan.');
      setSettings(result as AppSettings);
      setNotice('Pengaturan berhasil disimpan.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tidak dapat terhubung ke server.');
    } finally {
      setSavingDays(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">{{
          settings: 'Pengaturan',
          services: 'Master layanan',
          users: 'Master pengguna',
          speeds: 'Master kecepatan laundry',
        }[section]}</h1>
        <p className="mt-1 text-sm text-neutral-600">{{
          settings: 'Atur ambang peringatan cucian yang belum diambil.',
          services: 'Kelola jenis layanan dan tahapan produksinya.',
          users: 'Kelola akun petugas dan hak akses.',
          speeds: 'Atur pilihan kecepatan; tarif dan estimasi dihitung dari pengali di sini.',
        }[section]}</p>
      </header>

      {error && <div role="alert" className="flex items-center gap-3 border border-red-300 bg-red-50 p-4 text-sm text-red-900"><AlertCircle size={20} /><span className="flex-1">{error}</span><button type="button" onClick={() => setRetry((value) => value + 1)} className="min-h-11 border border-red-400 px-3">Coba lagi</button></div>}
      {notice && <p role="status" className="border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950">{notice}</p>}

      {loading ? <div aria-label="Memuat pengaturan" className="space-y-3"><div className="h-24 animate-pulse bg-neutral-200" /><div className="h-48 animate-pulse bg-neutral-200" /></div> : (
        <>
          {section === 'services' && <section className="space-y-4">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-xl font-semibold">Daftar layanan</h2><p className="text-sm text-neutral-600">Tarif dan durasi dasar dikalikan sesuai kecepatan yang dipilih saat transaksi.</p></div>
              {!serviceForm && <button type="button" onClick={() => editService(null)} className="inline-flex min-h-11 items-center gap-2 bg-cyan-800 px-4 text-sm font-semibold text-white hover:bg-cyan-900"><Plus size={20} />Tambah layanan</button>}
            </header>

            {serviceForm && (
              <form onSubmit={saveService} className="space-y-4 rounded-[var(--radius-control)] border border-neutral-300 bg-white p-4 sm:p-6">
                <div className="flex items-center justify-between gap-3"><h3 className="text-xl font-semibold">{editingServiceId ? 'Ubah layanan' : 'Layanan baru'}</h3><button type="button" onClick={() => setServiceForm(null)} aria-label="Tutup formulir layanan" className="flex min-h-11 min-w-11 items-center justify-center hover:bg-neutral-100"><X size={20} /></button></div>
                {formError && <p role="alert" className="text-sm text-red-900">{formError}</p>}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="text-sm font-medium">Nama layanan<input required maxLength={191} value={serviceForm.name} onChange={(event) => setServiceForm({ ...serviceForm, name: event.target.value })} className="mt-1 min-h-11 w-full border border-neutral-400 px-3 text-base" /></label>
                  <label className="text-sm font-medium">Satuan harga<select value={serviceForm.unitCode} onChange={(event) => setServiceForm({ ...serviceForm, unitCode: event.target.value as UnitCode })} className="mt-1 min-h-11 w-full border border-neutral-400 bg-white px-3 text-base">{Object.entries(unitLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
                  <label className="text-sm font-medium">Tarif dasar (Rp)<input type="number" min="0" step="1" required value={serviceForm.regularPrice} onChange={(event) => setServiceForm({ ...serviceForm, regularPrice: Number(event.target.value) })} className="mt-1 min-h-11 w-full border border-neutral-400 px-3 text-base tabular-nums" /></label>
                  <label className="text-sm font-medium">Durasi dasar (jam)<input type="number" min="1" max="8760" required value={serviceForm.durationHrs} onChange={(event) => setServiceForm({ ...serviceForm, durationHrs: Number(event.target.value) })} className="mt-1 min-h-11 w-full border border-neutral-400 px-3 text-base" /></label>
                </div>
                <fieldset><legend className="text-sm font-medium">Tahap produksi yang dibutuhkan</legend><div className="mt-2 flex flex-wrap gap-4">{stages.map((stage) => <label key={stage.value} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={serviceForm.stages.includes(stage.value)} onChange={(event) => setServiceForm({ ...serviceForm, stages: event.target.checked ? [...serviceForm.stages, stage.value] : serviceForm.stages.filter((item) => item !== stage.value) })} className="h-4 w-4" />{stage.label}</label>)}</div></fieldset>
                <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={serviceForm.isActive} onChange={(event) => setServiceForm({ ...serviceForm, isActive: event.target.checked })} className="h-4 w-4" />Layanan aktif dan dapat dipilih untuk transaksi</label>
                <div className="flex flex-wrap gap-2"><button type="submit" disabled={savingService} className="inline-flex min-h-11 items-center gap-2 bg-cyan-800 px-4 text-sm font-semibold text-white hover:bg-cyan-900 disabled:opacity-50"><Save size={16} />{savingService ? 'Menyimpan...' : 'Simpan layanan'}</button><button type="button" onClick={() => setServiceForm(null)} className="min-h-11 border border-neutral-400 px-4 text-sm">Batal</button></div>
              </form>
            )}

            {services.length === 0 ? <p className="rounded-[var(--radius-control)] border border-neutral-200 bg-white p-6 text-sm text-neutral-600">Belum ada layanan. Tambahkan layanan agar transaksi dapat dibuat.</p> : (
              <div className="overflow-x-auto rounded-[var(--radius-control)] border border-neutral-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-neutral-300 bg-neutral-100 text-xs font-semibold uppercase text-neutral-700"><tr><th className="px-4 py-3">Layanan</th><th className="px-4 py-3">Tarif dasar</th><th className="px-4 py-3">Durasi dasar</th><th className="px-4 py-3">Tahap produksi</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Aksi</th></tr></thead>
                  <tbody className="divide-y divide-neutral-200">{services.map((service) => <tr key={service.id}>
                    <td className="px-4 py-3"><p className="font-medium">{service.name}</p><p className="text-xs text-neutral-600">{unitLabels[service.unitCode]}</p></td>
                    <td className="px-4 py-3 tabular-nums">{money(service.regularPrice)}</td>
                    <td className="px-4 py-3">{service.durationHrs} jam</td>
                    <td className="px-4 py-3">{service.stages.length ? service.stages.map((item) => stages.find((stage) => stage.value === item.stage)?.label).join(', ') : 'Langsung dikemas'}</td>
                    <td className="px-4 py-3">{service.isActive ? 'Aktif' : 'Nonaktif'}</td>
                    <td className="px-4 py-3"><button type="button" onClick={() => editService(service)} className="inline-flex min-h-11 items-center gap-2 border border-neutral-400 px-3 text-xs hover:bg-neutral-100"><Pencil size={16} />Ubah</button></td>
                  </tr>)}</tbody>
                </table>
              </div>
            )}
          </section>}

          {section === 'users' && <section className="space-y-4">
            <div><h2 className="text-xl font-semibold">Akun dan peran</h2><p className="text-sm text-neutral-600">Kata sandi awal minimal 12 karakter. Akun nonaktif tidak dapat masuk.</p></div>
            <form onSubmit={createStaff} className="grid gap-4 rounded-[var(--radius-control)] border border-neutral-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
              <label className="text-sm font-medium">Nama<input required value={staffName} onChange={(event) => setStaffName(event.target.value)} className="mt-1 min-h-11 w-full border border-neutral-400 px-3 text-base" /></label>
              <label className="text-sm font-medium">Email<input required type="email" value={staffEmail} onChange={(event) => setStaffEmail(event.target.value)} className="mt-1 min-h-11 w-full border border-neutral-400 px-3 text-base" /></label>
              <label className="text-sm font-medium">Kata sandi awal<input required type="password" minLength={12} value={staffPassword} onChange={(event) => setStaffPassword(event.target.value)} className="mt-1 min-h-11 w-full border border-neutral-400 px-3 text-base" /></label>
              <label className="text-sm font-medium">Peran<select value={staffRole} onChange={(event) => setStaffRole(event.target.value as 'CASHIER' | 'WASHER')} className="mt-1 min-h-11 w-full border border-neutral-400 bg-white px-3 text-base"><option value="CASHIER">Kasir</option><option value="WASHER">Petugas cuci</option></select></label>
              <button type="submit" disabled={savingStaff} className="mt-auto min-h-11 border border-cyan-800 px-4 text-sm font-semibold text-cyan-900 hover:bg-cyan-50 disabled:opacity-50">{savingStaff ? 'Menyimpan...' : 'Tambah staf'}</button>
            </form>
            {staff.length === 0 ? <p className="rounded-[var(--radius-control)] border border-neutral-200 bg-white p-6 text-sm text-neutral-600">Belum ada akun staf.</p> : (
              <div className="overflow-x-auto rounded-[var(--radius-control)] border border-neutral-200 bg-white"><table className="w-full text-left text-sm">
                <thead className="border-b border-neutral-300 bg-neutral-100 text-xs font-semibold uppercase text-neutral-700"><tr><th className="px-4 py-3">Nama</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Peran</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Aksi</th></tr></thead>
                <tbody className="divide-y divide-neutral-200">{staff.map((member) => <tr key={member.id}>
                  <td className="px-4 py-3 font-medium">{member.name}</td><td className="px-4 py-3">{member.email}</td>
                  <td className="px-4 py-3"><select aria-label={`Peran ${member.name}`} value={member.role} disabled={member.id === currentUser.id} onChange={(event) => void updateStaff(member.id, { role: event.target.value as Staff['role'] })} className="min-h-11 border border-neutral-400 bg-white px-2"><option value="OWNER">Pemilik</option><option value="CASHIER">Kasir</option><option value="WASHER">Petugas cuci</option></select></td>
                  <td className="px-4 py-3">{member.isActive ? 'Aktif' : 'Nonaktif'}</td>
                  <td className="px-4 py-3"><button type="button" disabled={member.id === currentUser.id} onClick={() => void updateStaff(member.id, { isActive: !member.isActive })} className="min-h-11 border border-neutral-400 px-3 text-xs disabled:opacity-50">{member.isActive ? 'Nonaktifkan' : 'Aktifkan'}</button></td>
                </tr>)}</tbody>
              </table></div>
            )}
          </section>}

          {section === 'speeds' && <section className="space-y-4">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-xl font-semibold">Daftar kecepatan</h2><p className="text-sm text-neutral-600">Pengali tarif dan durasi diterapkan pada nilai dasar setiap layanan.</p></div>
              {!speedForm && <button type="button" onClick={() => editSpeed(null)} className="inline-flex min-h-11 items-center gap-2 bg-cyan-800 px-4 text-sm font-semibold text-white hover:bg-cyan-900"><Plus size={20} />Tambah kecepatan</button>}
            </header>
            {speedForm && (
              <form onSubmit={saveSpeed} className="space-y-4 rounded-[var(--radius-control)] border border-neutral-300 bg-white p-4 sm:p-6">
                <div className="flex items-center justify-between gap-3"><h3 className="text-xl font-semibold">{editingSpeedId ? 'Ubah kecepatan' : 'Kecepatan baru'}</h3><button type="button" onClick={() => setSpeedForm(null)} aria-label="Tutup formulir kecepatan" className="flex min-h-11 min-w-11 items-center justify-center hover:bg-neutral-100"><X size={20} /></button></div>
                {formError && <p role="alert" className="text-sm text-red-900">{formError}</p>}
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="text-sm font-medium">Nama kecepatan<input required maxLength={191} value={speedForm.name} onChange={(event) => setSpeedForm({ ...speedForm, name: event.target.value })} className="mt-1 min-h-11 w-full border border-neutral-400 px-3 text-base" /></label>
                  <label className="text-sm font-medium">Pengali tarif<input type="number" min="0.1" max="10" step="0.1" required value={speedForm.priceMultiplier} onChange={(event) => setSpeedForm({ ...speedForm, priceMultiplier: Number(event.target.value) })} className="mt-1 min-h-11 w-full border border-neutral-400 px-3 text-base" /><span className="text-xs text-neutral-600">1,5 berarti tarif dasar dikali 1,5.</span></label>
                  <label className="text-sm font-medium">Pengali durasi<input type="number" min="0.1" max="10" step="0.1" required value={speedForm.durationMultiplier} onChange={(event) => setSpeedForm({ ...speedForm, durationMultiplier: Number(event.target.value) })} className="mt-1 min-h-11 w-full border border-neutral-400 px-3 text-base" /><span className="text-xs text-neutral-600">0,5 berarti estimasi durasi menjadi setengahnya.</span></label>
                </div>
                <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={speedForm.isActive} onChange={(event) => setSpeedForm({ ...speedForm, isActive: event.target.checked })} className="h-4 w-4" />Kecepatan aktif dan dapat dipilih untuk transaksi</label>
                <div className="flex flex-wrap gap-2"><button type="submit" disabled={savingSpeed} className="inline-flex min-h-11 items-center gap-2 bg-cyan-800 px-4 text-sm font-semibold text-white hover:bg-cyan-900 disabled:opacity-50"><Save size={16} />{savingSpeed ? 'Menyimpan...' : 'Simpan kecepatan'}</button><button type="button" onClick={() => setSpeedForm(null)} className="min-h-11 border border-neutral-400 px-4 text-sm">Batal</button></div>
              </form>
            )}
            {speeds.length === 0 ? <p className="rounded-[var(--radius-control)] border border-neutral-200 bg-white p-6 text-sm text-neutral-600">Belum ada kecepatan. Tambahkan kecepatan agar dapat dipilih dalam transaksi.</p> : (
              <div className="overflow-x-auto rounded-[var(--radius-control)] border border-neutral-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-neutral-300 bg-neutral-100 text-xs font-semibold uppercase text-neutral-700"><tr><th className="px-4 py-3">Nama</th><th className="px-4 py-3">Pengali tarif</th><th className="px-4 py-3">Pengali durasi</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Aksi</th></tr></thead>
                  <tbody className="divide-y divide-neutral-200">{speeds.map((speed) => <tr key={speed.id}>
                    <td className="px-4 py-3 font-medium">{speed.name}</td>
                    <td className="px-4 py-3 tabular-nums">{speed.priceMultiplier}×</td>
                    <td className="px-4 py-3 tabular-nums">{speed.durationMultiplier}×</td>
                    <td className="px-4 py-3">{speed.isActive ? 'Aktif' : 'Nonaktif'}</td>
                    <td className="px-4 py-3"><div className="flex gap-2"><button type="button" onClick={() => editSpeed(speed)} className="inline-flex min-h-11 items-center gap-2 border border-neutral-400 px-3 text-xs hover:bg-neutral-100"><Pencil size={16} />Ubah</button><button type="button" onClick={() => void updateSpeed(speed)} className="min-h-11 border border-neutral-400 px-3 text-xs">{speed.isActive ? 'Nonaktifkan' : 'Aktifkan'}</button></div></td>
                  </tr>)}</tbody>
                </table>
              </div>
            )}
          </section>}

          {section === 'settings' && <section className="rounded-[var(--radius-control)] border border-neutral-200 bg-white p-4 sm:p-6">
            <h2 className="text-xl font-semibold">Cucian belum diambil</h2>
            <p className="mt-1 text-sm text-neutral-600">Tandai pesanan berstatus siap diambil setelah melewati jumlah hari ini.</p>
            <form onSubmit={saveDays} className="mt-4 flex flex-wrap items-end gap-3">
              <label className="text-sm font-medium">Batas peringatan (hari)
                <input type="number" min="1" max="365" required value={settings.uncollectedReadyDays} onChange={(event) => setSettings({ uncollectedReadyDays: Number(event.target.value) })} className="mt-1 block min-h-11 w-40 border border-neutral-400 px-3 text-base" />
              </label>
              <button type="submit" disabled={savingDays} className="min-h-11 border border-cyan-800 px-4 text-sm font-semibold text-cyan-900 hover:bg-cyan-50 disabled:opacity-50">{savingDays ? 'Menyimpan...' : 'Simpan pengaturan'}</button>
            </form>
          </section>}
        </>
      )}
    </div>
  );
}
