'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  BarChart3, Check, ChevronDown, ClipboardList, Database, Globe, LayoutDashboard, Loader2, LogOut, MoreHorizontal,
  Search, Settings, Store, Users, WashingMachine, X,
} from 'lucide-react';
import InstallAppButton from '@/components/InstallAppButton';
import ThemeToggle from '@/components/ThemeToggle';
import type { CurrentUser } from '@/lib/auth';

type AppUser = CurrentUser;

const AppUserContext = createContext<AppUser | null>(null);

export function useCurrentUser() {
  const user = useContext(AppUserContext);
  if (!user) throw new Error('Informasi akun tidak tersedia.');
  return user;
}

const roleLabels = {
  SUPER_OWNER: 'Super Owner',
  OWNER: 'Pemilik Toko',
  CASHIER: 'Kasir',
  WASHER: 'Petugas Cuci',
} as const;

const desktopItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['SUPER_OWNER', 'OWNER', 'CASHIER', 'WASHER'] },
  { label: 'Pesanan', href: '/orders', icon: ClipboardList, roles: ['SUPER_OWNER', 'OWNER', 'CASHIER', 'WASHER'] },
  { label: 'Pelanggan', href: '/customers', icon: Users, roles: ['SUPER_OWNER', 'OWNER', 'CASHIER'] },
  { label: 'Kelola Toko', href: '/stores', icon: Store, roles: ['SUPER_OWNER'] },
  { label: 'Laporan', href: '/reports', icon: BarChart3, roles: ['SUPER_OWNER', 'OWNER', 'CASHIER'] },
  { label: 'Pengaturan', href: '/settings', icon: Settings, roles: ['SUPER_OWNER', 'OWNER'] },
] as const;

const masterDataItems = [
  { label: 'Layanan', href: '/master-data/services' },
  { label: 'Pengguna', href: '/master-data/users' },
  { label: 'Kecepatan laundry', href: '/master-data/speeds' },
] as const;

function SearchableStoreDropdown({
  user,
  switchingStore,
  onSelect,
}: {
  user: AppUser;
  switchingStore: boolean;
  onSelect: (val: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      window.setTimeout(() => inputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const isGlobalActive = user.activeStoreId === null;
  const currentLabel = isGlobalActive
    ? 'Semua Cabang (Global)'
    : user.activeStore
    ? `[${user.activeStore.code}] ${user.activeStore.name}`
    : 'Pilih Cabang';

  const normalizedQuery = query.trim().toLowerCase();
  const showGlobalOption =
    user.role === 'SUPER_OWNER' &&
    (!normalizedQuery ||
      'semua cabang global'.includes(normalizedQuery) ||
      'semua'.includes(normalizedQuery) ||
      'global'.includes(normalizedQuery));

  const filteredStores = (user.stores || []).filter((s) => {
    if (!normalizedQuery) return true;
    return (
      s.code.toLowerCase().includes(normalizedQuery) ||
      s.name.toLowerCase().includes(normalizedQuery) ||
      (s.address && s.address.toLowerCase().includes(normalizedQuery))
    );
  });

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        disabled={switchingStore}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex max-w-[190px] items-center gap-1.5 rounded-md border border-neutral-300 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-800 transition hover:border-cyan-600 focus:border-cyan-600 focus:outline-none sm:max-w-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:border-cyan-500"
      >
        {switchingStore ? (
          <Loader2 size={14} className="shrink-0 animate-spin text-cyan-600 dark:text-cyan-400" />
        ) : isGlobalActive ? (
          <Globe size={14} className="shrink-0 text-cyan-700 dark:text-cyan-400" />
        ) : (
          <Store size={14} className="shrink-0 text-cyan-700 dark:text-cyan-400" />
        )}
        <span className="truncate">{currentLabel}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-neutral-500 transition-transform dark:text-neutral-400 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-72 rounded-md border border-neutral-200 bg-white p-2 shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
          <div className="relative mb-2">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Cari cabang..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded border border-neutral-300 bg-white py-1.5 pl-8 pr-7 text-xs text-neutral-900 focus:border-cyan-600 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Hapus pencarian"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="max-h-56 space-y-1 overflow-y-auto" role="listbox">
            {showGlobalOption && (
              <button
                type="button"
                role="option"
                aria-selected={isGlobalActive}
                onClick={async () => {
                  setOpen(false);
                  await onSelect('all');
                }}
                className={`flex w-full items-center justify-between gap-2 rounded px-2.5 py-1.5 text-left text-xs transition ${
                  isGlobalActive
                    ? 'bg-cyan-50 font-semibold text-cyan-900 dark:bg-cyan-950/60 dark:text-cyan-300'
                    : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Globe size={14} className="shrink-0 text-cyan-600 dark:text-cyan-400" />
                  <span className="truncate">Semua Cabang (Global)</span>
                </div>
                {isGlobalActive && <Check size={14} className="shrink-0 text-cyan-700 dark:text-cyan-400" />}
              </button>
            )}

            {filteredStores.map((st) => {
              const isSelected = user.activeStoreId === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={async () => {
                    setOpen(false);
                    await onSelect(String(st.id));
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded px-2.5 py-1.5 text-left text-xs transition ${
                    isSelected
                      ? 'bg-cyan-50 font-semibold text-cyan-900 dark:bg-cyan-950/60 dark:text-cyan-300'
                      : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2 truncate">
                    <Store size={14} className="shrink-0 text-cyan-600 dark:text-cyan-400" />
                    <div className="truncate">
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100">[{st.code}]</span>{' '}
                      <span>{st.name}</span>
                    </div>
                  </div>
                  {isSelected && <Check size={14} className="shrink-0 text-cyan-700 dark:text-cyan-400" />}
                </button>
              );
            })}

            {!showGlobalOption && filteredStores.length === 0 && (
              <p className="py-3 text-center text-xs text-neutral-500 dark:text-neutral-400">
                Tidak ada cabang ditemukan
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AppShell({ user, children }: { user: AppUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [masterDataOpen, setMasterDataOpen] = useState<boolean | null>(null);
  const [switchingStore, setSwitchingStore] = useState(false);
  const masterDataExpanded = masterDataOpen ?? pathname.startsWith('/master-data');
  const [logoutError, setLogoutError] = useState('');

  const visibleItems = desktopItems.filter((item) =>
    item.roles.some((role) => role === user.role),
  );
  const mobileItems = [
    desktopItems[0],
    desktopItems[1],
    ...(user.role === 'SUPER_OWNER' || user.role === 'OWNER' || user.role === 'CASHIER' ? [desktopItems[2]] : []),
  ];

  async function handleStoreChange(val: string) {
    setSwitchingStore(true);
    try {
      const res = await fetch('/api/stores/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: val === 'all' ? 'all' : Number(val) }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal beralih cabang.');
      }
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal beralih cabang.');
      setSwitchingStore(false);
    }
  }

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
      <div className="min-h-dvh bg-neutral-50 text-neutral-900 transition-colors duration-150 dark:bg-neutral-950 dark:text-neutral-100">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-neutral-200 bg-white transition-colors duration-150 lg:flex lg:flex-col dark:border-neutral-800 dark:bg-neutral-900">
          <Link href="/" className="flex h-16 items-center gap-3 border-b border-neutral-200 px-6 dark:border-neutral-800">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-cyan-700 text-white dark:bg-cyan-600">
              <WashingMachine size={20} />
            </span>
            <span className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">LaundryPOS</span>
          </Link>

          {/* Active Store Indicator in Sidebar */}
          <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Cabang Aktif</p>
            <div className="mt-1 flex items-center gap-1.5 truncate text-xs font-semibold text-neutral-800 dark:text-neutral-200">
              {user.activeStore ? (
                <>
                  <Store size={14} className="shrink-0 text-cyan-700 dark:text-cyan-400" />
                  <span className="truncate">[{user.activeStore.code}] {user.activeStore.name}</span>
                </>
              ) : user.role === 'SUPER_OWNER' ? (
                <>
                  <Globe size={14} className="shrink-0 text-cyan-700 dark:text-cyan-400" />
                  <span className="truncate">Semua Cabang (Global)</span>
                </>
              ) : (
                <span>-</span>
              )}
            </div>
          </div>

          <nav aria-label="Menu utama" className="flex-1 space-y-1 px-3 py-4">
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
                      ? 'border-cyan-700 bg-cyan-50 font-semibold text-cyan-900 dark:border-cyan-500 dark:bg-cyan-950/60 dark:text-cyan-300'
                      : 'border-transparent text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
                  }`}
                >
                  <Icon size={20} />
                  {item.label}
                </Link>
              );
            })}
            {(user.role === 'SUPER_OWNER' || user.role === 'OWNER') && (
              <div>
                <button
                  type="button"
                  aria-expanded={masterDataExpanded}
                  aria-controls="master-data-links"
                  onClick={() => setMasterDataOpen((open) => !(open ?? pathname.startsWith('/master-data')))}
                  className={`flex min-h-11 w-full items-center gap-3 border-l-4 px-3 text-left text-sm transition ${
                    pathname.startsWith('/master-data')
                      ? 'border-cyan-700 bg-cyan-50 font-semibold text-cyan-900 dark:border-cyan-500 dark:bg-cyan-950/60 dark:text-cyan-300'
                      : 'border-transparent text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
                  }`}
                >
                  <Database size={20} />
                  <span className="flex-1">Data Master</span>
                  <ChevronDown size={16} className={masterDataOpen ? 'rotate-180' : ''} />
                </button>
                {masterDataExpanded && (
                  <div id="master-data-links" className="ml-5 border-l border-neutral-300 pl-3 dark:border-neutral-700">
                    {masterDataItems.map((item) => {
                      const active = isActive(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          aria-current={active ? 'page' : undefined}
                          className={`flex min-h-11 items-center border-l-2 px-3 text-sm transition ${
                            active
                              ? 'border-cyan-700 font-semibold text-cyan-900 dark:border-cyan-500 dark:text-cyan-300'
                              : 'border-transparent text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
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
          <div className="border-t border-neutral-200 p-4 dark:border-neutral-800">
            <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">{user.name}</p>
            <p className="mb-3 text-xs text-neutral-600 dark:text-neutral-400">{roleLabels[user.role]}</p>
            <button type="button" onClick={logout} className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm text-neutral-700 transition hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800">
              <LogOut size={20} />
              Keluar
            </button>
          </div>
        </aside>

        <div className="lg:pl-60">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-neutral-200 bg-white px-4 transition-colors duration-150 sm:px-6 lg:px-8 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2 font-bold text-neutral-900 lg:hidden dark:text-neutral-100">
                <WashingMachine size={20} className="text-cyan-800 dark:text-cyan-400" />
                <span className="hidden sm:inline">LaundryPOS</span>
              </Link>

              {/* Store Switcher */}
              {(user.role === 'SUPER_OWNER' || (user.stores && user.stores.length > 1)) ? (
                <SearchableStoreDropdown
                  user={user}
                  switchingStore={switchingStore}
                  onSelect={handleStoreChange}
                />
              ) : user.activeStore ? (
                <div className="hidden items-center gap-1.5 rounded-md bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 sm:inline-flex dark:bg-neutral-800 dark:text-neutral-300">
                  <Store size={14} className="text-cyan-700 dark:text-cyan-400" />
                  [{user.activeStore.code}] {user.activeStore.name}
                </div>
              ) : null}
            </div>

            <div className="hidden text-sm font-medium text-neutral-600 lg:block dark:text-neutral-400">{roleLabels[user.role]}</div>

            <div className="ml-auto flex items-center gap-3">
              <InstallAppButton />
              <ThemeToggle />
              <span className="hidden max-w-48 truncate text-sm font-medium text-neutral-800 sm:inline dark:text-neutral-200">{user.name}</span>
              <button type="button" onClick={logout} aria-label="Keluar" className="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-neutral-300 text-neutral-700 transition hover:bg-neutral-100 lg:hidden dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800">
                <LogOut size={20} />
              </button>
            </div>
          </header>

          {logoutError && (
            <div role="alert" className="border-b border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 sm:px-6 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300">
              {logoutError}
            </div>
          )}

          <main className="mx-auto w-full max-w-[1280px] px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-8">
            {children}
          </main>
        </div>

        <nav aria-label="Navigasi ponsel" className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-300 bg-white transition-colors duration-150 lg:hidden dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mx-auto flex max-w-xl items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]">
            {mobileItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-xs leading-tight ${active ? 'font-semibold text-cyan-900 dark:text-cyan-300' : 'text-neutral-700 dark:text-neutral-400'}`}
                >
                  <span className={`flex h-8 w-10 items-center justify-center rounded-md ${active ? 'bg-cyan-50 dark:bg-cyan-950/70' : ''}`}>
                    <Icon size={20} />
                  </span>
                  <span className="text-center">{item.label === 'Dashboard' ? 'Beranda' : item.label}</span>
                </Link>
              );
            })}
            <div className="relative flex min-w-0 flex-1">
              <button
                type="button"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((open) => !open)}
                className="flex min-h-16 w-full flex-col items-center justify-center gap-1 px-1 text-xs text-neutral-700 dark:text-neutral-400"
              >
                <span className="flex h-8 w-10 items-center justify-center rounded-md">
                  <MoreHorizontal size={20} />
                </span>
                Lainnya
              </button>
              {moreOpen && (
                <div className="absolute bottom-full right-2 mb-2 w-52 rounded-[var(--radius-control)] border border-neutral-300 bg-white p-2 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                  {visibleItems.filter((item) => item.href === '/reports' || item.href === '/settings' || item.href === '/stores').map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)} className="flex min-h-11 items-center gap-3 px-3 text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800">
                        <Icon size={20} />
                        {item.label}
                      </Link>
                    );
                  })}
                  {(user.role === 'SUPER_OWNER' || user.role === 'OWNER') && masterDataItems.map((item) => (
                    <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)} className="flex min-h-11 items-center px-3 text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800">
                      {item.label}
                    </Link>
                  ))}
                  <div className="border-t border-neutral-200 py-1 dark:border-neutral-800">
                    <ThemeToggle showLabel className="w-full justify-start border-none px-3 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800" />
                  </div>
                  <button type="button" onClick={logout} className="flex min-h-11 w-full items-center gap-3 px-3 text-left text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800">
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
