import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import ReportsClient from '@/components/ReportsClient';
import { getCurrentUser } from '@/lib/auth';

export default function ReportsPage() {
  return (
    <Suspense fallback={<div aria-label="Memuat laporan" className="min-h-48 animate-pulse bg-neutral-100" />}>
      <AuthorizedReportsPage />
    </Suspense>
  );
}

async function AuthorizedReportsPage() {
  await connection();
  const user = await getCurrentUser();
  if (!user || user.role === 'WASHER') redirect('/');
  return <ReportsClient />;
}
