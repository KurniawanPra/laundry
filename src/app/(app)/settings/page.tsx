import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import SettingsClient from '@/components/SettingsClient';
import { getCurrentUser } from '@/lib/auth';

export default function SettingsPage() {
  return (
    <Suspense fallback={<div aria-label="Memuat pengaturan" className="min-h-48 animate-pulse bg-neutral-100" />}>
      <AuthorizedSettingsPage />
    </Suspense>
  );
}

async function AuthorizedSettingsPage() {
  await connection();
  const user = await getCurrentUser();
  if (!user || user.role !== 'OWNER') redirect('/');
  return <SettingsClient section="settings" />;
}
