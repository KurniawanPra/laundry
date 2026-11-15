'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { WashingMachine } from 'lucide-react';

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal masuk.');
      router.replace('/');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tidak dapat terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-50 px-4 py-8">
      <section className="w-full max-w-sm rounded-[var(--radius-control)] border border-neutral-300 bg-white p-6">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-800 text-white">
            <WashingMachine size={20} />
          </span>
          <div>
            <h1 className="text-xl font-bold">LaundryPOS</h1>
            <p className="text-sm text-neutral-600">Masuk ke akun Anda</p>
          </div>
        </div>
        {error && <p role="alert" className="mb-4 border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="mb-1 block text-sm font-medium">Email</label>
            <input id="login-email" autoComplete="username" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="min-h-11 w-full border border-neutral-400 px-3 text-base outline-none focus:border-cyan-800 focus:ring-2 focus:ring-cyan-800/20" />
          </div>
          <div>
            <label htmlFor="login-password" className="mb-1 block text-sm font-medium">Kata sandi</label>
            <input id="login-password" autoComplete="current-password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="min-h-11 w-full border border-neutral-400 px-3 text-base outline-none focus:border-cyan-800 focus:ring-2 focus:ring-cyan-800/20" />
          </div>
          <button type="submit" disabled={loading} className="min-h-11 w-full bg-cyan-800 px-4 text-sm font-semibold text-white hover:bg-cyan-900 disabled:opacity-60">
            {loading ? 'Memeriksa akun...' : 'Masuk'}
          </button>
        </form>
      </section>
    </main>
  );
}
