'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RedirectToLogin() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login');
  }, [router]);

  return (
    <>
      <meta httpEquiv="refresh" content="0; url=/login" />
      <div className="flex min-h-dvh items-center justify-center bg-neutral-50 text-neutral-600 dark:bg-neutral-950 dark:text-neutral-400" aria-label="Mengalihkan ke halaman login...">
        <p className="text-sm">Mengalihkan ke halaman login...</p>
      </div>
    </>
  );
}
