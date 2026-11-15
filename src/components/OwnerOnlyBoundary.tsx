import { Suspense, type ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export default function OwnerOnlyBoundary({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div aria-label="Memuat halaman pemilik" className="min-h-48 animate-pulse bg-neutral-100" />}>
      <OwnerOnlyContent>{children}</OwnerOnlyContent>
    </Suspense>
  );
}

async function OwnerOnlyContent({ children }: { children: ReactNode }) {
  await connection();
  const user = await getCurrentUser();
  if (!user || user.role !== 'OWNER') redirect('/');
  return children;
}
