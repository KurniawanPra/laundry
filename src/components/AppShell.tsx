'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useState } from 'react';
import {
  BarChart3, ChevronDown, ClipboardList, Database, LayoutDashboard, LogOut, MoreHorizontal,
  Settings, Users, WashingMachine,
} from 'lucide-react';
import InstallAppButton from '@/components/InstallAppButton';

type AppUser = {
  id: number;
  name: string;
  email: string;
  role: 'OWNER' | 'CASHIER' | 'WASHER';
};

const AppUserContext = createContext<AppUser | null>(null);

export function useCurrentUser() {
  const user = useContext(AppUserContext);
  if (!user) throw new Error('Informasi akun tidak tersedia.');
  return user;
}

const roleLabels = {
  OWNER: 'Pemilik',
  CASHIER: 'Kasir',
  WASHER: 'Petugas cuci',
} as const;

const desktopItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['OWNER', 'CASHIER', 'WASHER'] },
  { label: 'Pesanan', href: '/orders', icon: ClipboardList, roles: ['OWNER', 'CASHIER', 'WASHER'] },
  { label: 'Pelanggan', href: '/customers', icon: Users, roles: ['OWNER', 'CASHIER'] },
  { label: 'Laporan', href: '/reports', icon: BarChart3, roles: ['OWNER', 'CASHIER'] },
  { label: 'Pengaturan', href: '/settings', icon: Settings, roles: ['OWNER'] },
] as const;

const masterDataItems = [
  { label: 'Layanan', href: '/master-data/services' },
  { label: 'Pengguna', href: '/master-data/users' },
  { label: 'Kecepatan laundry', href: '/master-data/speeds' },
] as const;

export default function AppShell({ user, children }: { user: AppUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [masterDataOpen, setMasterDataOpen] = useState<boolean | null>(null);
  const masterDataExpanded = masterDataOpen ?? pathname.startsWith('/master-data');
  const [logoutError, setLogoutError] = useState('');
  const visibleItems = desktopItems.filter((item) =>
    item.roles.some((role) => role === user.role),
  );
  const mobileItems = [
    desktopItems[0],
    desktopItems[1],
    ...(user.role === 'OWNER' || user.role === 'CASHIER' ? [desktopItems[2]] : []),
  ];

  async function logout() {
    setLogoutError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Gagal keluar. Coba lagi.');
      router.replace('/login');
      router.refresh();
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : 'Gagal keluar. Coba lagi.');
    }
  }

  function isActive(href: string) {
    return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <AppUserContext.Provider value={user}>
    <div className="min-h-dvh bg-neutral-50 text-neutral-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-neutral-200 bg-white lg:flex lg:flex-col">
        <Link href="/" className="flex h-16 items-center gap-3 border-b border-neutral-200 px-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-cyan-700 text-white">
            <WashingMachine size={20} />
          </span>
          <span className="text-xl font-bold tracking-tight">LaundryPOS</span>
        </Link>
        <nav aria-label="Menu utama" className="flex-1 space-y-1 px-3 py-6">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-11 items-center gap-3 border-l-4 px-3 text-sm transition ${
                  active
                    ? 'border-cyan-700 bg-cyan-50 font-semibold text-cyan-900'
                    : 'border-transparent text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            );
          })}
          {user.role === 'OWNER' && (
            <div>
              <button
                type="button"
                aria-expanded={masterDataExpanded}
                aria-controls="master-data-links"
                onClick={() => setMasterDataOpen((open) => !(open ?? pathname.startsWith('/master-data')))}
                className={`flex min-h-11 w-full items-center gap-3 border-l-4 px-3 text-left text-sm ${
                  pathname.startsWith('/master-data')
                    ? 'border-cyan-700 bg-cyan-50 font-semibold text-cyan-900'
                    : 'border-transparent text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                <Database size={20} />
                <span className="flex-1">Data Master</span>
                <ChevronDown size={16} className={masterDataOpen ? 'rotate-180' : ''} />
              </button>
              {masterDataExpanded && (
                <div id="master-data-links" className="ml-5 border-l border-neutral-300 pl-3">
                  {masterDataItems.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={`flex min-h-11 items-center border-l-2 px-3 text-sm ${
                          active
                            ? 'border-cyan-700 font-semibold text-cyan-900'
                            : 'border-transparent text-neutral-700 hover:bg-neutral-100'
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>
        <div className="border-t border-neutral-200 p-4">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="mb-3 text-xs text-neutral-600">{roleLabels[user.role]}</p>
          <button type="button" onClick={logout} className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm text-neutral-700 hover:bg-neutral-100">
            <LogOut size={20} />
            Keluar
          </button>
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-neutral-200 bg-white px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 font-bold lg:hidden">
            <WashingMachine size={20} className="text-cyan-800" />
            LaundryPOS
          </Link>
          <div className="hidden text-sm font-medium text-neutral-600 lg:block">{roleLabels[user.role]}</div>
          <div className="ml-auto flex items-center gap-3">
            <InstallAppButton />
            <span className="hidden max-w-48 truncate text-sm font-medium sm:inline">{user.name}</span>
            <button type="button" onClick={logout} aria-label="Keluar" className="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-neutral-300 text-neutral-700 hover:bg-neutral-100 lg:hidden">
              <LogOut size={20} />
            </button>
          </div>
        </header>

        {logoutError && (
          <div role="alert" className="border-b border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 sm:px-6">
            {logoutError}
          </div>
        )}

        <main className="mx-auto w-full max-w-[1280px] px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-8">
          {children}
        </main>
      </div>

      <nav aria-label="Navigasi ponsel" className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-300 bg-white lg:hidden">
        <div className="mx-auto flex max-w-xl items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]">
          {mobileItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            const primary = item.href === '/orders/new';
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-xs leading-tight ${
                  primary ? 'font-semibold text-cyan-900' : active ? 'font-semibold text-cyan-900' : 'text-neutral-700'
                }`}
              >
                <span className={`flex h-8 w-10 items-center justify-center rounded-md ${primary ? 'bg-cyan-800 text-white' : active ? 'bg-cyan-50' : ''}`}>
                  <Icon size={20} />
                </span>
                <span className="text-center">{item.label === 'Dashboard' ? 'Beranda' : item.label === 'Transaksi Baru' ? 'Transaksi' : item.label}</span>
              </Link>
            );
          })}
          <div className="relative flex min-w-0 flex-1">
            <button
              type="button"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((open) => !open)}
              className="flex min-h-16 w-full flex-col items-center justify-center gap-1 px-1 text-xs text-neutral-700"
            >
              <span className="flex h-8 w-10 items-center justify-center rounded-md">
                <MoreHorizontal size={20} />
              </span>
              Lainnya
            </button>
            {moreOpen && (
              <div className="absolute bottom-full right-2 mb-2 w-52 border border-neutral-300 bg-white p-2">
                {visibleItems.filter((item) => item.href === '/reports' || item.href === '/settings').map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)} className="flex min-h-11 items-center gap-3 px-3 text-sm hover:bg-neutral-100">
                      <Icon size={20} />
                      {item.label}
                    </Link>
                  );
                })}
                {user.role === 'OWNER' && masterDataItems.map((item) => (
                  <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)} className="flex min-h-11 items-center px-3 text-sm hover:bg-neutral-100">
                    {item.label}
                  </Link>
                ))}
                <button type="button" onClick={logout} className="flex min-h-11 w-full items-center gap-3 px-3 text-left text-sm hover:bg-neutral-100">
                  <LogOut size={20} />
                  Keluar
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
    </div>
    </AppUserContext.Provider>
  );
}
