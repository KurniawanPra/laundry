'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle({
  className = '',
  showLabel = false,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'dark' : 'light');
    setMounted(true);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
      try {
        localStorage.setItem('theme', 'dark');
      } catch (_) {}
    } else {
      document.documentElement.classList.remove('dark');
      try {
        localStorage.setItem('theme', 'light');
      } catch (_) {}
    }
  }

  if (!mounted) {
    return (
      <button
        type="button"
        disabled
        aria-label="Memuat tema..."
        className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-neutral-300 text-neutral-500 opacity-60 ${className}`}
      >
        <Moon size={18} aria-hidden />
        {showLabel && <span className="ml-2 text-sm">Mode gelap</span>}
      </button>
    );
  }

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
      title={isDark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-neutral-300 px-3 text-neutral-700 transition hover:bg-neutral-100 ${className}`}
    >
      {isDark ? (
        <>
          <Sun size={18} className="text-amber-400" aria-hidden />
          {showLabel && <span className="ml-2 text-sm font-medium">Mode terang</span>}
        </>
      ) : (
        <>
          <Moon size={18} className="text-neutral-700" aria-hidden />
          {showLabel && <span className="ml-2 text-sm font-medium">Mode gelap</span>}
        </>
      )}
    </button>
  );
}
