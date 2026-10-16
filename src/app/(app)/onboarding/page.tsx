'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/client/store';
import type { ProblemCode } from '@/domain/types';
import { PROBLEMS } from '@/domain/problems/catalog';
import { Mascot } from '@/components/ui/Mascot';
import { Wave } from '@/components/ui/Wave';
import s from '@/components/exercise/exercise.module.css';

const GOALS = [
  { min: 10, title: '10 минут', note: 'лёгкий старт' },
  { min: 15, title: '15 минут', note: 'утренний ритуал' },
  { min: 30, title: '30 минут', note: 'серьёзно' },
  { min: 60, title: '60 минут', note: 'интенсив' },
];

/** Первый вход: что мешает + цель дня. Задаёт стартовый профиль проблем. */
export default function Onboarding() {
  const { state, patchProfile } = useApp();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<Set<ProblemCode>>(new Set(state.profile.self_problems));
  const [goal, setGoal] = useState(state.profile.daily_goal_min || 15);

  function finish() {
    patchProfile({ self_problems: [...picked], daily_goal_min: goal, onboarded: true });
    router.replace('/');
  }

  return (
    <main className={s.page} style={{ minHeight: '100dvh' }}>
      <Wave value={(step + 1) / 3} color="var(--coral)" bars={18} height={18} />
      {step === 0 && (
        <div className="stack-lg rise">
          <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-end' }}>
            <Mascot mood="cheer" size={110} bob />
            <p className="bubble">Я Мик, твой тренер речи. Каждый день — короткая тренировка, и мысль начинает звучать чётко.</p>
          </div>
          <h1>Как это работает</h1>
          <ol className={`${s.instr} card`}>
            <li>Утренний ритуал на 7–15 минут: разминка, дыхание, мысль по каркасу.</li>
            <li>Записываешь дубль — я разбираю: паразиты, темп, паузы, структура.</li>
            <li>Запоминаю твои слабые места и собираю упражнения именно под них.</li>
            <li>Занимайся сколько хочешь — лимита нет, всё идёт в прогресс.</li>
          </ol>
          <button className="btn btn-primary btn-lg btn-block" onClick={() => setStep(1)}>
            Поехали
          </button>
        </div>
      )}
      {step === 1 && (
        <div className="stack-lg rise">
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <Mascot mood="coach" size={70} />
            <p className="bubble">Что мешает тебе сейчас? Отметь честно — потом уточню по записям.</p>
          </div>
          <div className="stack">
            {PROBLEMS.map((p) => {
              const on = picked.has(p.code);
              return (
                <button
                  key={p.code}
                  className="card card-press"
                  aria-pressed={on}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, background: on ? 'var(--lilac-soft)' : undefined }}
                  onClick={() => {
                    const n = new Set(picked);
                    if (on) n.delete(p.code);
                    else n.add(p.code);
                    setPicked(n);
                  }}
                >
                  <span className={s.stageDot} style={{ background: on ? 'var(--lilac)' : undefined, color: '#fff', flex: 'none' }}>
                    {on ? '✓' : ''}
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column' }}>
                    <b>{p.title}</b>
                    <span className="small muted">{p.short}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <button className="btn btn-primary btn-lg btn-block" onClick={() => setStep(2)}>
            {picked.size ? 'Дальше' : 'Не знаю — определи сам'}
          </button>
        </div>
      )}
      {step === 2 && (
        <div className="stack-lg rise">
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <Mascot mood="happy" size={70} />
            <p className="bubble">Сколько минут в день — цель? Это не потолок: можно больше, всё засчитается.</p>
          </div>
          <div className="stack">
            {GOALS.map((g) => (
              <button
                key={g.min}
                className="card card-press"
                aria-pressed={goal === g.min}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, background: goal === g.min ? 'var(--sun-soft)' : undefined }}
                onClick={() => setGoal(g.min)}
              >
                <b style={{ fontFamily: 'var(--display)' }}>{g.title}</b>
                <span className="small muted">{g.note}</span>
              </button>
            ))}
          </div>
          <button className="btn btn-mint btn-lg btn-block" onClick={finish}>
            Начать тренировку
          </button>
        </div>
      )}
    </main>
  );
}
