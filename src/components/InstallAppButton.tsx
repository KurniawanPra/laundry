'use client';

import { useEffect, useState } from 'react';
import { Download, Share, Smartphone, X } from 'lucide-react';
import { Button } from '@/components/ui';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export default function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    const appleMobile = /iPhone|iPad|iPod/i.test(window.navigator.userAgent) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    const browserStateTimeout = window.setTimeout(() => {
      setIsInstalled(standalone);
      setIsIos(appleMobile && !standalone);
    }, 0);

    const handleInstallAvailable = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleInstallAvailable);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.clearTimeout(browserStateTimeout);
      window.removeEventListener('beforeinstallprompt', handleInstallAvailable);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  if (isInstalled || (!installPrompt && !isIos && !error)) return null;

  async function handleInstall() {
    if (!installPrompt) {
      setShowIosHelp((current) => !current);
      return;
    }

    setError('');
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') setIsInstalled(true);
    } catch {
      setError('Tidak dapat membuka pemasangan. Coba gunakan menu browser.');
    } finally {
      setInstallPrompt(null);
    }
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="secondary"
        onClick={handleInstall}
        aria-label={isIos ? 'Petunjuk pasang aplikasi' : 'Pasang LaundryPOS'}
        aria-expanded={showIosHelp || Boolean(error)}
        className="px-3 text-accent"
      >
        {isIos ? <Share size={20} /> : <Download size={20} />}
        <span className="hidden sm:inline">{isIos ? 'Cara pasang' : 'Pasang aplikasi'}</span>
      </Button>
      {(showIosHelp || error) && (
        <div role="status" className="absolute right-0 top-full z-50 mt-2 w-72 rounded-[var(--radius-control)] border border-neutral-300 bg-white p-4 text-sm text-neutral-800 shadow-md">
          <div className="flex items-start gap-3">
            {isIos && <Smartphone size={20} className="mt-0.5 shrink-0 text-cyan-700" />}
            <p>{error || 'Di Safari, ketuk Bagikan lalu pilih "Tambahkan ke Layar Utama".'}</p>
            <button
              type="button"
              onClick={() => { setShowIosHelp(false); setError(''); }}
              aria-label="Tutup petunjuk"
              className="ml-auto shrink-0 text-slate-400 hover:text-slate-700"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
