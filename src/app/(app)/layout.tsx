'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AppProvider, useApp } from '@/client/store';
import { Mascot } from '@/components/ui/Mascot';

function Loading() {
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
      <div style={{ display: 'grid', justifyItems: 'center', gap: 12 }}>
        <Mascot mood="happy" size={88} bob />
        <span className="label">Разминаем голос…</span>
      </div>
    </div>
  );
}

/** Тема из профиля и редирект на онбординг */
function Effects() {
  const { state } = useApp();
  const path = usePathname();
  const router = useRouter();
  useEffect(() => {
    const t = state.profile.theme;
    if (t === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem('rech-theme', t);
    } catch {}
  }, [state.profile.theme]);
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  useEffect(() => {
    if (!state.profile.onboarded && path !== '/onboarding') router.replace('/onboarding');
  }, [state.profile.onboarded, path, router]);
  return null;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider fallback={<Loading />}>
      <Effects />
      {children}
    </AppProvider>
  );
}
