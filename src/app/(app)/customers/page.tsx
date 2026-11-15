import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import CustomersClient from '@/components/CustomersClient';
import { getCurrentUser } from '@/lib/auth';

export default function CustomersPage() {
  return (
    <Suspense fallback={<div aria-label="Memuat pelanggan" className="min-h-48 animate-pulse bg-neutral-100" />}>
      <AuthorizedCustomersPage />
    </Suspense>
  );
}

async function AuthorizedCustomersPage() {
  await connection();
  const user = await getCurrentUser();
  if (!user || user.role === 'WASHER') redirect('/');
  return <CustomersClient />;
}
