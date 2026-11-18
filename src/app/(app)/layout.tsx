import { Suspense, type ReactNode } from 'react';
import { connection } from 'next/server';
import AppShell from '@/components/AppShell';
import RedirectToLogin from '@/components/RedirectToLogin';
import { getCurrentUser } from '@/lib/auth';

export default function ApplicationLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-neutral-50 dark:bg-neutral-950" aria-label="Memuat aplikasi" />}>
      <ProtectedApplication>{children}</ProtectedApplication>
    </Suspense>
  );
}

async function ProtectedApplication({ children }: { children: ReactNode }) {
  await connection();
  const user = await getCurrentUser();
  if (!user) {
    return <RedirectToLogin />;
  }

  return (
    <AppShell user={user}>
      {children}
    </AppShell>
  );
}
