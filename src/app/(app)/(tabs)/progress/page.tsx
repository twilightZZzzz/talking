'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useApp } from '@/client/store';
import { TopStats } from '@/components/shell/TopStats';
import { ACHIEVEMENTS } from '@/domain/gamification/achievements';
import { addDays } from '@/domain/calendar';
import { problemInfo } from '@/domain/problems/catalog';
import { Bar } from '@/components/ui/Wave';
import { Icon } from '@/components/ui/Icon';
import { Mascot } from '@/components/ui/Mascot';
import s from '@/components/progress/progress.module.css';

const DOW = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export default function ProgressPage() {
  const { stats, state, problems, today } = useApp();
  const lv = stats.level;

  const days14 = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(today, i - 13)), [today]);
  const maxMin = Math.max(state.profile.daily_goal_min, ...days14.map((d) => stats.perDay[d]?.minutes ?? 0));

  // паразиты в минуту по дням (средние по разобранным дублям)
  const fpmByDay = useMemo(() => {
    const m: Record<string, number[]> = {};
    for (const t of state.takes) if (t.status === 'done' && t.metrics) (m[t.session_date] ??= []).push(t.metrics.fpm);
    return m;
  }, [state.takes]);
  const fpmVals = days14.map((d) => (fpmByDay[d]?.length ? fpmByDay[d].reduce((a, b) => a + b, 0) / fpmByDay[d].length : null));
  const maxFpm = Math.max(3, ...fpmVals.map((v) => v ?? 0));
  const manual = days14.map((d) => state.sessions.find((x) => x.date === d)?.fillers ?? null);
  const maxManual = Math.max(5, ...manual.map((v) => v ?? 0));
  const hasFpm = fpmVals.some((v) => v !== null);

  const zones = problems.scores.filter((p) => p.score > 0 || p.count > 0).slice(0, 8);
  const got = new Map(state.achievements.map((a) => [a.code, a.unlocked_at]));
  const takes = [...state.takes].filter((t) => t.status === 'done').sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 12);

  return (
    <>
      <TopStats />
      <h1>Прогресс</h1>

      <section className={s.kpis}>
        <div className="card" style={{ background: 'var(--sun-soft)' }}>
          <span className="label">Уровень {lv.index + 1}</span>
          <b className={s.kpi}>{lv.name}</b>
          <Bar value={lv.next ? (stats.xp - lv.min) / (lv.next.min - lv.min) : 1} />
          <span className="small muted">{lv.next ? `до «${lv.next.name}» ${lv.next.min - stats.xp} XP` : 'максимум'}</span>
        </div>
        <div className="card" style={{ background: 'var(--coral-soft)' }}>
          <span className="label">Серия</span>
          <b className={s.kpi}>
            <Icon name="flame" size={26} /> {stats.streak}
          </b>
          <span className="small muted">рекорд {stats.maxStreak ?? stats.streak} · множитель ×{(stats.multiplier ?? 1).toFixed(1)}</span>
        </div>
        <div className="card" style={{ background: 'var(--sky-soft)' }}>
          <span className="label">Всего практики</span>
          <b className={s.kpi}>{fmtMin(stats.minutesTotal)}</b>
          <span className="small muted">разобрано дублей: {stats.takesAnalyzed}</span>
        </div>
        <div className="card" style={{ background: 'var(--mint-soft)' }}>
          <span className="label">Рекорд по «э»</span>
          <b className={s.kpi}>{stats.bestFillers ?? '—'}</b>
          <span className="small muted">меньше всего паразитов за день</span>
        </div>
      </section>

      <section className="card">
        <h2>Последние 8 недель</h2>
        <div className={s.calHead}>
          {DOW.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className={s.cal}>
          {stats.calendar.map((c) => (
            <span key={c.date} data-l={c.level} data-today={c.date === today} data-future={c.date > today} title={`${c.date}: ${Math.round(stats.perDay[c.date]?.minutes ?? 0)} мин`} />
          ))}
        </div>
        <div className={s.legend}>
          <span>
            <i data-l="0" /> пропуск
          </span>
          <span>
            <i data-l="1" /> практика
          </span>
          <span>
            <i data-l="2" /> цель дня
          </span>
        </div>
      </section>

      <section className="card">
        <h2>Минуты практики, 14 дней</h2>
        <div className={s.chart}>
          {days14.map((d) => {
            const v = stats.perDay[d]?.minutes ?? 0;
            return (
              <div key={d} className={s.col} title={`${d}: ${Math.round(v)} мин`}>
                <span className={s.barV} style={{ height: `${Math.max(3, (v / maxMin) * 100)}%`, background: v >= state.profile.daily_goal_min ? 'var(--sun)' : 'var(--sky)' }} />
                <small>{d.slice(8)}</small>
              </div>
            );
          })}
          <span className={s.goalLine} style={{ bottom: `calc(${(state.profile.daily_goal_min / maxMin) * 100}% * 0.86 + 18px)` }}>
            цель
          </span>
        </div>
      </section>

      <section className="card">
        <h2>{hasFpm ? 'Паразиты в минуту, 14 дней' : 'Паразиты, 14 дней'}</h2>
        {!hasFpm && !manual.some((v) => v !== null) ? (
          <p className="muted small">Пока пусто. Разбери дубль или сохрани день — здесь появится динамика.</p>
        ) : (
          <div className={s.chart}>
            {days14.map((d, i) => {
              const v = hasFpm ? fpmVals[i] : manual[i];
              const max = hasFpm ? maxFpm : maxManual;
              return (
                <div key={d} className={s.col} title={v === null ? d : `${d}: ${hasFpm ? (v as number).toFixed(1) + '/мин' : v}`}>
                  {v !== null && <em className={s.val}>{hasFpm ? (v as number).toFixed(1) : v}</em>}
                  <span className={s.barV} style={{ height: v === null ? '2px' : `${Math.max(4, ((v as number) / max) * 100)}%`, background: v === null ? 'var(--line)' : 'var(--berry)' }} />
                  <small>{d.slice(8)}</small>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>Твои зоны роста</h2>
          <Link href="/practice" className="small" style={{ fontWeight: 700 }}>
            План →
          </Link>
        </div>
        {zones.length === 0 ? (
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <Mascot mood="think" size={56} />
            <p className="small muted">Профиль соберётся после первых разборов: что мешает именно тебе и что уже улучшается.</p>
          </div>
        ) : (
          <div className="stack">
            {zones.map((z) => {
              const info = problemInfo(z.code);
              const better = z.trend < -0.05;
              const worse = z.trend > 0.05;
              return (
                <div key={z.code} className={s.zone}>
                  <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                    <b>{info?.title ?? z.code}</b>
                    <span className="small" style={{ color: better ? 'var(--mint)' : worse ? 'var(--berry)' : 'var(--muted)', fontWeight: 800 }}>
                      {better ? '↓ лучше' : worse ? '↑ хуже' : z.count ? '→ стабильно' : 'самооценка'}
                    </span>
                  </div>
                  <Bar value={z.score / 100} color={z.score >= 60 ? 'var(--berry)' : z.score >= 30 ? 'var(--coral)' : 'var(--sun)'} height={12} />
                  <span className="small muted">{info?.tip}</span>
                </div>
              );
            })}
          </div>
        )}
        {problems.topFillers.length > 0 && (
          <div className="stack" style={{ gap: 6 }}>
            <span className="label">Любимые паразиты</span>
            <div className="row" style={{ gap: 6 }}>
              {problems.topFillers.slice(0, 8).map((f) => (
                <span key={f.word} className="chip chip-berry">
                  «{f.word}» × {f.count}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>Достижения</h2>
          <span className="small muted">
            {got.size} из {ACHIEVEMENTS.length}
          </span>
        </div>
        <div className={s.ach}>
          {ACHIEVEMENTS.map((a, i) => (
            <div key={a.id} className={s.badge} data-got={got.has(a.id)} style={{ ['--rot' as string]: `${((i * 7) % 9) - 4}deg` }}>
              <span className={s.medal}>{got.has(a.id) ? <Icon name="star" size={22} /> : <Icon name="lock" size={18} />}</span>
              <b>{a.title}</b>
              <span>{a.desc}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="stack">
        <h2>Последние дубли</h2>
        {takes.length === 0 ? (
          <p className="muted small">Ещё нет разобранных дублей.</p>
        ) : (
          takes.map((t) => (
            <Link key={t.id} href={`/takes/${t.id}`} className="card card-press" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, textDecoration: 'none', color: 'inherit' }}>
              <span className="chip chip-sky">{t.session_date.slice(8)}.{t.session_date.slice(5, 7)}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.topic ?? 'Без темы'}</b>
                <span className="small muted">
                  {t.metrics?.fillers_count ?? 0} паразитов · {t.metrics?.wpm ?? 0} сл/мин · ясность {t.feedback?.clarity ?? '—'}
                </span>
              </span>
              <Icon name="chevron" size={18} />
            </Link>
          ))
        )}
      </section>
    </>
  );
}

function fmtMin(m: number) {
  const h = Math.floor(m / 60);
  return h ? `${h} ч ${Math.round(m % 60)} мин` : `${Math.round(m)} мин`;
}
