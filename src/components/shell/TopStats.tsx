'use client';

import Link from 'next/link';
import { useApp } from '@/client/store';
import { levelFor } from '@/domain/gamification/levels';
import { Icon } from '@/components/ui/Icon';
import s from './shell.module.css';

/** Серия · XP · уровень + индикатор синхронизации */
export function TopStats() {
  const { stats, syncStatus } = useApp();
  const lv = levelFor(stats.xp);
  return (
    <div className={s.top}>
      <Link href="/progress" className={`${s.pill} ${stats.streak >= 3 ? s.hot : ''}`} aria-label={`Серия ${stats.streak} дней`}>
        <Icon name="flame" size={20} />
        <b className="num">{stats.streak}</b>
      </Link>
      <Link href="/progress" className={s.pill} aria-label={`${stats.xp} XP`}>
        <Icon name="bolt" size={20} />
        <b className="num">{stats.xp.toLocaleString('ru-RU')}</b>
      </Link>
      <Link href="/progress" className={`${s.pill} ${s.lvl}`} aria-label={`Уровень ${lv.index + 1}: ${lv.name}`}>
        <span className={s.lvlBadge}>{lv.index + 1}</span>
        <b>{lv.name}</b>
      </Link>
      <span className={s.sync} data-s={syncStatus} title={SYNC[syncStatus]} aria-label={SYNC[syncStatus]} />
    </div>
  );
}

const SYNC = {
  synced: 'Всё сохранено',
  pending: 'Сохраняю…',
  offline: 'Нет сети — сохранено на устройстве',
  error: 'Ошибка синхронизации',
} as const;
