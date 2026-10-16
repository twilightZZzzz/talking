'use client';

import Link from 'next/link';
import type { Exercise, ExerciseCategory } from '@/domain/types';
import { problemInfo } from '@/domain/problems/catalog';
import { Icon, type IconName } from '@/components/ui/Icon';

export const CATEGORY: Record<ExerciseCategory, { title: string; icon: IconName; color: string }> = {
  warmup: { title: 'Разминка', icon: 'spark', color: 'var(--sun)' },
  breath: { title: 'Дыхание и голос', icon: 'wind', color: 'var(--sky)' },
  structure: { title: 'Каркас мысли', icon: 'book', color: 'var(--lilac)' },
  pauses: { title: 'Паузы вместо «э»', icon: 'pause', color: 'var(--mint)' },
  pace: { title: 'Темп', icon: 'gauge', color: 'var(--coral)' },
  impro: { title: 'Импровизация', icon: 'bulb', color: 'var(--berry)' },
  retell: { title: 'Пересказ', icon: 'refresh', color: 'var(--sky)' },
};

export function ExerciseCard({ ex, href, why, done }: { ex: Pick<Exercise, 'id' | 'title' | 'category' | 'minutes' | 'targets' | 'speaking'>; href?: string; why?: string; done?: boolean }) {
  const c = CATEGORY[ex.category] ?? CATEGORY.impro;
  return (
    <Link
      href={href ?? `/exercise/${ex.id}`}
      className="card card-press"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, textDecoration: 'none', color: 'inherit', opacity: done ? 0.6 : 1 }}
    >
      <span
        style={{
          flex: 'none',
          width: 46,
          height: 46,
          borderRadius: 14,
          display: 'grid',
          placeItems: 'center',
          background: c.color,
          color: '#fff',
          border: 'var(--stroke)',
          transform: 'rotate(-4deg)',
        }}
      >
        <Icon name={done ? 'check' : c.icon} size={24} />
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <b style={{ fontFamily: 'var(--display)', fontSize: 15 }}>{ex.title}</b>
        {why ? <span className="small muted">{why}</span> : null}
        <span className="small muted">
          {ex.minutes} мин{ex.speaking ? ' · запись' : ''}
          {ex.targets.length ? ' · ' + ex.targets.slice(0, 2).map((t) => problemInfo(t)?.title.toLowerCase() ?? t).join(', ') : ''}
        </span>
      </span>
      <Icon name="chevron" size={20} />
    </Link>
  );
}
