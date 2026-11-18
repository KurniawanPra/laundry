'use client';

import { useEffect, useRef, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { X } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'border border-accent bg-accent text-white hover:bg-accent-hover dark:border-cyan-600 dark:bg-cyan-600 dark:hover:bg-cyan-500',
  secondary: 'border border-neutral-400 bg-white text-neutral-900 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800',
  danger: 'border border-red-800 bg-red-800 text-white hover:bg-red-900 dark:border-red-700 dark:bg-red-900 dark:hover:bg-red-800',
  ghost: 'border border-transparent bg-transparent text-neutral-800 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800',
};

export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button {...props} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 ${buttonStyles[variant]} ${className}`} />;
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`min-h-11 w-full rounded-[var(--radius-control)] border border-neutral-400 bg-white px-3 text-base text-neutral-950 placeholder:text-neutral-500 focus:border-accent dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:placeholder:text-neutral-500 dark:focus:border-cyan-500 ${className}`} />;
}

export function Badge({
  children,
  icon: Icon,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  icon?: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
  className?: string;
}) {
  const tones = {
    neutral: 'border-neutral-300 bg-neutral-100 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200',
    success: 'border-emerald-700 bg-emerald-50 text-emerald-950 dark:border-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-300',
    warning: 'border-amber-700 bg-amber-50 text-amber-950 dark:border-amber-600 dark:bg-amber-950/70 dark:text-amber-300',
    danger: 'border-red-700 bg-red-50 text-red-950 dark:border-red-600 dark:bg-red-950/70 dark:text-red-300',
  };
  return <span className={`inline-flex items-center gap-1 rounded-[var(--radius-badge)] border px-2 py-1 text-xs font-semibold ${tones[tone]} ${className}`}>{Icon && <Icon size={16} aria-hidden />}{children}</span>;
}

export function Card({ className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return <section {...props} className={`rounded-[var(--radius-control)] border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 ${className}`} />;
}

export function Table({ className = '', ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table {...props} className={`w-full border-collapse text-left text-sm ${className}`} />;
}

export function TableHead({ className = '', ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} className={`border-b border-neutral-300 bg-neutral-100 text-xs font-semibold uppercase text-neutral-700 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-300 ${className}`} />;
}

export function TableBody({ className = '', ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} className={`divide-y divide-neutral-200 dark:divide-neutral-800 ${className}`} />;
}

export function TableRow({ className = '', ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr {...props} className={`hover:bg-neutral-50 dark:hover:bg-neutral-800/60 ${className}`} />;
}

export function TableHeaderCell({ className = '', ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return <th {...props} className={`px-4 py-3 ${className}`} />;
}

export function TableCell({ className = '', ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return <td {...props} className={`px-4 py-3 ${className}`} />;
}

export function Dialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableSelector = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    dialogRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeRef.current();
        return;
      }
      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector)];
        if (focusable.length === 0) {
          event.preventDefault();
          dialogRef.current.focus();
        } else if (event.shiftKey && document.activeElement === focusable[0]) {
          event.preventDefault();
          focusable.at(-1)?.focus();
        } else if (!event.shiftKey && document.activeElement === focusable.at(-1)) {
          event.preventDefault();
          focusable[0]?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-neutral-950/50 backdrop-blur-xs p-4 dark:bg-black/80" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="dialog-title" className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-[var(--radius-control)] border border-neutral-300 bg-white p-4 shadow-md sm:p-6 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100">
        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 id="dialog-title" className="text-xl font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Tutup dialog" className="flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-control)] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300"><X size={20} /></button>
        </header>
        {children}
      </section>
    </div>
  );
}
