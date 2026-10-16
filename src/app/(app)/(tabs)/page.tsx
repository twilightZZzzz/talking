'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useApp } from '@/client/store';
import { TopStats } from '@/components/shell/TopStats';
import { SunGoal } from '@/components/ui/SunGoal';
import { Wave } from '@/components/ui/Wave';
import { Mascot, type Mood } from '@/components/ui/Mascot';
import { Icon } from '@/components/ui/Icon';
import { ExerciseCard } from '@/components/practice/ExerciseCard';
import { getChallenge } from '@/domain/content';
import { getExercise, recommendExercises } from '@/domain/exercises';
import { problemInfo } from '@/domain/problems/catalog';
import { dayNumber } from '@/domain/calendar';
import s from '@/components/today/today.module.css';

const RITUAL = [0, 1, 2, 3, 4];
const FULL_ONLY = new Set([1, 4]);

export default function TodayPage() {
  const { session, stats, state, problems, patchSession, today } = useApp();
  const mode = session.mode;
  const steps = RITUAL.filter((i) => mode === 'full' || !FULL_ONLY.has(i));
  const doneCount = steps.filter((i) => session.steps_done.includes(i)).length;
  const goal = state.profile.daily_goal_min;
  const minutes = stats.minutesToday;
  const challenge = getChallenge(session.challenge_id);
  const nextStep = steps.find((i) => !session.steps_done.includes(i));
  const top = problems.scores.find((p) => p.score >= 25);

  const forYou = useMemo(
    () => recommendExercises(problems, { exclude: steps.map((i) => `ritual-${i}`), count: 2, seed: dayNumber(today) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [problems, today, mode],
  );

  const hour = new Date().getHours();
  const hello = hour < 5 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
  const goalMet = minutes >= goal;
  const mood: Mood = goalMet ? 'cheer' : doneCount === 0 && stats.streak > 0 ? 'coach' : 'happy';
  const line = goalMet
    ? 'Цель дня есть. Дальше — бонусные минуты, всё идёт в копилку.'
    : doneCount === 0
      ? stats.streak > 0
        ? `Серия ${stats.streak} дн. Не отдадим её — начнём с разминки.`
        : 'Начнём с разминки. Пять шагов — и мысль будет звучать чище.'
      : `Ещё ${Math.max(1, Math.ceil(goal - minutes))} мин до цели дня.`;

  return (
    <>
      <TopStats />

      <section className={`card ${s.hero}`}>
        <div className={s.heroText}>
          <span className="label">{new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <h1>{hello}!</h1>
          <div className={s.mik}>
            <Mascot mood={mood} size={58} />
            <p className="bubble small">{line}</p>
          </div>
        </div>
        <div className={s.sun}>
          <SunGoal minutes={minutes} goal={goal} />
          <span className="label">цель дня</span>
        </div>
      </section>

      <section className={s.week}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="label">Цель недели</span>
          <b className="num small">{stats.weekActive}/5 дней</b>
        </div>
        <Wave value={stats.weekActive / 5} color="var(--mint)" label="Цель недели" />
      </section>

      <section className="stack">
        <h2>Ритуал дня</h2>
        <div>
          <div className="seg" role="group" aria-label="Режим">
            <button aria-pressed={mode === 'full'} onClick={() => patchSession({ mode: 'full' })}>
              Утро · 15
            </button>
            <button aria-pressed={mode === 'exp'} onClick={() => patchSession({ mode: 'exp' })}>
              Экспресс · 7
            </button>
          </div>
        </div>
        <ol className={s.path}>
          {steps.map((i, k) => {
            const ex = getExercise(`ritual-${i}`);
            const done = session.steps_done.includes(i);
            const current = i === nextStep;
            return (
              <li key={i} className={s.stepItem}>
                <Link href={`/exercise/ritual-${i}`} className={`card card-press ${s.step}`} data-done={done} data-current={current}>
                  <span className={s.badge}>{done ? <Icon name="check" size={22} /> : k + 1}</span>
                  <span className={s.stepText}>
                    <b>{ex?.title ?? `Шаг ${i + 1}`}</b>
                    <span className="muted small">
                      {ex?.minutes ?? 3} мин · +{i === 3 ? 20 : 10} XP{ex?.speaking ? ' · запись' : ''}
                    </span>
                  </span>
                  {current && <span className="chip chip-coral">Дальше</span>}
                  {!current && !done && <Icon name="chevron" size={20} />}
                </Link>
              </li>
            );
          })}
        </ol>
        {doneCount === steps.length && (
          <div className="card card-tint" style={{ ['--tint' as string]: 'var(--mint-soft)' }}>
            <b>Ритуал пройден.</b>
            <span className="small">Время есть? Продолжай — лимита нет. Свободный дубль или упражнение под твои проблемы ниже.</span>
          </div>
        )}
      </section>

      {challenge && (
        <section className={`card ${s.challenge}`}>
          <div className="row">
            <Icon name="trophy" size={26} />
            <span className="label" style={{ color: 'var(--fg)' }}>
              Челлендж дня · +25 XP
            </span>
          </div>
          <p className={s.chTitle}>{challenge.title}</p>
          <p className="small muted">{challenge.hint}</p>
          {top && challenge.targets.includes(top.code) && (
            <span className="chip chip-lilac" style={{ alignSelf: 'flex-start' }}>
              Подобран под: {problemInfo(top.code)?.title.toLowerCase()}
            </span>
          )}
        </section>
      )}

      <Link href="/exercise/free" className={`btn btn-sky btn-lg btn-block`}>
        <Icon name="mic" /> Свободный дубль
      </Link>

      <section className="stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>Для тебя</h2>
          <Link href="/practice" className="small" style={{ fontWeight: 700 }}>
            Вся практика →
          </Link>
        </div>
        {problems.takesAnalyzed === 0 && !state.profile.self_problems.length ? (
          <p className="muted small">Запиши пару дублей — я пойму, что мешает именно тебе, и буду подбирать упражнения.</p>
        ) : null}
        <div className="stack">
          {forYou.map((ex) => (
            <ExerciseCard key={ex.id} ex={ex} />
          ))}
        </div>
      </section>
    </>
  );
}
