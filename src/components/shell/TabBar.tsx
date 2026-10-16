'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Mascot } from '@/components/ui/Mascot';
import s from './shell.module.css';

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: '/', label: 'Сегодня', icon: 'home' },
  { href: '/practice', label: 'Практика', icon: 'mic' },
  { href: '/progress', label: 'Прогресс', icon: 'chart' },
  { href: '/profile', label: 'Профиль', icon: 'user' },
];

export function TabBar() {
  const path = usePathname();
  return (
    <nav className={s.tabs} aria-label="Разделы">
      <div className={s.brand}>
        <Mascot size={40} />
        <span>Утренняя речь</span>
      </div>
      {TABS.map((t) => {
        const active = t.href === '/' ? path === '/' : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={s.tab} aria-current={active ? 'page' : undefined}>
            <Icon name={t.icon} size={24} />
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
