import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import LoginForm from '@/components/LoginForm';
import { getCurrentUser } from '@/lib/auth';

export const instant = false;

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-neutral-50 dark:bg-neutral-950" aria-label="Memuat halaman masuk" />}>
      <LoginRedirect />
    </Suspense>
  );
}

async function LoginRedirect() {
  await connection();
  const user = await getCurrentUser();
  if (user) redirect('/');
  return <LoginForm />;
}
