import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import AppShell from '@/components/AppShell';
import { getCurrentUser } from '@/lib/auth';

export default function ApplicationLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-neutral-50" aria-label="Memuat aplikasi" />}>
      <ProtectedApplication>{children}</ProtectedApplication>
    </Suspense>
  );
}

async function ProtectedApplication({ children }: { children: ReactNode }) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <AppShell user={user}>
      {children}
    </AppShell>
  );
}
