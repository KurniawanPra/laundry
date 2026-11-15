import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import CheckoutClient from '@/components/CheckoutClient';
import { getCurrentUser } from '@/lib/auth';

export default function NewOrderPage() {
  return (
    <Suspense fallback={<div aria-label="Memuat transaksi" className="min-h-48 animate-pulse bg-neutral-100" />}>
      <AuthorizedNewOrderPage />
    </Suspense>
  );
}

async function AuthorizedNewOrderPage() {
  await connection();
  const user = await getCurrentUser();
  if (!user || user.role === 'WASHER') redirect('/');
  return <CheckoutClient />;
}
