import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import StoresClient from '@/components/StoresClient';

export default function StoresPage() {
  return (
    <Suspense fallback={<div aria-label="Memuat daftar toko" className="min-h-48 animate-pulse bg-neutral-100 dark:bg-neutral-800" />}>
      <AuthorizedStoresPage />
    </Suspense>
  );
}

async function AuthorizedStoresPage() {
  await connection();
  const user = await getCurrentUser();
  if (!user || user.role !== 'SUPER_OWNER') {
    redirect('/');
  }
  return <StoresClient />;
}
