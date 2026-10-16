'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useApp } from '@/client/store';
import type { CoachPlan, ExerciseCategory, ProblemCode } from '@/domain/types';
import { EXERCISES, recommendExercises } from '@/domain/exercises';
import { problemInfo } from '@/domain/problems/catalog';
import { dayNumber } from '@/domain/calendar';
import { ExerciseCard, CATEGORY } from '@/components/practice/ExerciseCard';
import { Mascot } from '@/components/ui/Mascot';
import { Icon } from '@/components/ui/Icon';

const CATS = Object.keys(CATEGORY) as ExerciseCategory[];

export default function PracticePage() {
  const { state, problems, setPlan, toast, stats, today } = useApp();
  const [cat, setCat] = useState<ExerciseCategory | 'all'>('all');
  const [target, setTarget] = useState<ProblemCode | null>(null);
  const [loading, setLoading] = useState(false);
  const plan = state.plan;
  const topProblems = problems.scores.filter((p) => p.score >= 20).slice(0, 4);

  const library = useMemo(
    () =>
      EXERCISES.filter((e) => !e.id.startsWith('ritual-'))
        .filter((e) => cat === 'all' || e.category === cat)
        .filter((e) => !target || e.targets.includes(target)),
    [cat, target],
  );
  const recommended = useMemo(
    () => recommendExercises(problems, { exclude: [], count: 3, seed: dayNumber(today) + 7 }).filter((e) => !e.id.startsWith('ritual-')),
    [problems, today],
  );

  async function newPlan() {
    setLoading(true);
    try {
      const r = await fetch('/api/coach/plan', { method: 'POST' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Не удалось составить план');
      setPlan((j.plan ?? j) as CoachPlan);
      toast('План обновлён', 'mint');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  const doneToday = state.activities.filter((a) => a.date === today && a.kind === 'drill').length;

  return (
    <>
      <header className="stack" style={{ gap: 6 }}>
        <h1>Практика</h1>
        <p className="muted">
          Без лимита. Сегодня: <b style={{ color: 'var(--fg)' }}>{Math.round(stats.minutesToday)} мин</b> · упражнений {doneToday}
        </p>
      </header>

      <Link href="/exercise/free" className="card card-press" style={{ flexDirection: 'row', alignItems: 'center', gap: 14, background: 'var(--sky-soft)', textDecoration: 'none', color: 'inherit' }}>
        <Mascot mood="happy" size={56} />
        <span style={{ flex: 1 }}>
          <b style={{ fontFamily: 'var(--display)', fontSize: 17 }}>Дубль на любую тему</b>
          <br />
          <span className="small muted">Своя или случайная тема, разбор ИИ, сколько угодно раз</span>
        </span>
        <Icon name="chevron" />
      </Link>

      <section className="stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>Мой план</h2>
          <button className="btn btn-sm btn-lilac" onClick={() => void newPlan()} disabled={loading}>
            <Icon name="refresh" size={16} /> {loading ? 'Составляю…' : plan ? 'Обновить' : 'Составить'}
          </button>
        </div>
        {topProblems.length > 0 ? (
          <div className="row" style={{ gap: 6 }}>
            <span className="small muted">Твои зоны роста:</span>
            {topProblems.map((p) => (
              <span key={p.code} className="chip chip-lilac">
                {problemInfo(p.code)?.title}
              </span>
            ))}
          </div>
        ) : null}
        {plan ? (
          <div className="stack">
            {plan.items.map((it) => (
              <ExerciseCard
                key={it.id}
                href={`/exercise/plan-${it.id}`}
                ex={{ id: it.id, title: it.title, category: 'structure', minutes: it.minutes, targets: it.targets, speaking: it.speaking }}
                why={it.why}
                done={plan.done.includes(it.id)}
              />
            ))}
            <p className="small muted">
              {plan.source === 'ai' ? 'Составил ИИ-тренер' : 'Составлен по твоему профилю'} · {new Date(plan.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
            </p>
          </div>
        ) : (
          <div className="card card-flat" style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Mascot mood="coach" size={56} />
            <p className="small">
              {problems.takesAnalyzed < 2
                ? 'Запиши 2–3 дубля, и я составлю план под твои проблемы: паразиты, темп, структуру.'
                : 'Нажми «Составить» — подберу упражнения под твои слабые места.'}
            </p>
          </div>
        )}
      </section>

      {recommended.length > 0 && (
        <section className="stack">
          <h2>Подобрано под тебя</h2>
          {recommended.map((ex) => (
            <ExerciseCard key={ex.id} ex={ex} />
          ))}
        </section>
      )}

      <section className="stack">
        <h2>Библиотека</h2>
        <div className="row" style={{ gap: 6, overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: 4 }}>
          <button className={`btn btn-sm ${cat === 'all' ? 'btn-sun' : ''}`} onClick={() => setCat('all')}>
            Все
          </button>
          {CATS.map((c) => (
            <button key={c} className={`btn btn-sm ${cat === c ? 'btn-sun' : ''}`} onClick={() => setCat(c)} style={{ whiteSpace: 'nowrap' }}>
              {CATEGORY[c].title}
            </button>
          ))}
        </div>
        {target && (
          <button className="chip chip-lilac" onClick={() => setTarget(null)} style={{ alignSelf: 'flex-start', cursor: 'pointer' }}>
            Против: {problemInfo(target)?.title} ✕
          </button>
        )}
        {!target && topProblems.length > 0 && (
          <div className="row" style={{ gap: 6 }}>
            <span className="small muted">Фильтр по проблеме:</span>
            {topProblems.map((p) => (
              <button key={p.code} className="chip" style={{ cursor: 'pointer' }} onClick={() => setTarget(p.code)}>
                {problemInfo(p.code)?.title}
              </button>
            ))}
          </div>
        )}
        <div className="stack">
          {library.map((ex) => (
            <ExerciseCard key={ex.id} ex={ex} />
          ))}
          {library.length === 0 && <p className="muted small">Здесь пусто — сними фильтр.</p>}
        </div>
      </section>
    </>
  );
}
