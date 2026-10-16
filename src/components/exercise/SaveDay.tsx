'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useApp } from '@/client/store';
import { getChallenge } from '@/domain/content';
import { levelFor } from '@/domain/gamification/levels';
import { localHour } from '@/domain/calendar';
import { Mascot } from '@/components/ui/Mascot';
import { Bar } from '@/components/ui/Wave';
import { Icon } from '@/components/ui/Icon';
import { chime } from './Timer';
import s from './exercise.module.css';

/** Шаг 04 «Разбор записи»: итог дня. Подставляет данные последнего разобранного дубля. */
export function SaveDay() {
  const { session, state, today, patchSession, addActivity, stats } = useApp();
  const todays = useMemo(
    () => state.takes.filter((t) => t.session_date === today && t.status === 'done').sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [state.takes, today],
  );
  const last = todays[0];
  const challenge = getChallenge(session.challenge_id);
  const [fillers, setFillers] = useState<number>(session.fillers ?? last?.metrics?.fillers_count ?? 0);
  const [clarity, setClarity] = useState<number | null>(session.clarity ?? last?.feedback?.clarity ?? null);
  const [chDone, setChDone] = useState<boolean>(session.challenge_done ?? last?.feedback?.challenge.done ?? false);
  const [note, setNote] = useState(session.note ?? '');
  const [saved, setSaved] = useState(false);
  const [xpBefore, setXpBefore] = useState(0);

  function save() {
    setXpBefore(stats.xp);
    const steps = session.steps_done.includes(3) ? session.steps_done : [...session.steps_done, 3].sort();
    const isFull = session.mode === 'full' && [0, 1, 2, 3, 4].every((i) => steps.includes(i));
    const now = new Date();
    patchSession({
      steps_done: steps,
      fillers,
      clarity,
      challenge_done: chDone,
      note: note.trim() || null,
      full: isFull || session.full,
      saved_at: session.saved_at ?? now.toISOString(),
      saved_hour: session.saved_hour ?? localHour(now, state.profile.timezone),
    });
    if (!state.activities.some((a) => a.kind === 'ritual_step' && a.date === today && a.ref === '3'))
      addActivity({ kind: 'ritual_step', ref: '3', duration_s: 180, meta: {} });
    if (!state.activities.some((a) => a.kind === 'day_saved' && a.date === today)) addActivity({ kind: 'day_saved', ref: today, duration_s: 0, meta: {} });
    chime(523, 0.15);
    setTimeout(() => chime(784, 0.25), 150);
    setSaved(true);
  }

  if (saved) {
    const pd = stats.perDay[today];
    const lv = levelFor(stats.xp);
    const gained = Math.max(0, stats.xp - xpBefore);
    return (
      <div className={`card ${s.party}`}>
        <div className={s.confetti} aria-hidden>
          {Array.from({ length: 26 }, (_, i) => (
            <i
              key={i}
              style={{
                left: `${(i * 37) % 100}%`,
                background: ['var(--sun)', 'var(--coral)', 'var(--mint)', 'var(--sky)', 'var(--lilac)', 'var(--berry)'][i % 6],
                animationDelay: `${(i % 7) * 0.12}s`,
              }}
            />
          ))}
        </div>
        <Mascot mood="cheer" size={110} />
        <h1>День сохранён!</h1>
        <div className={s.partyStats}>
          <div style={{ background: 'var(--sun-soft)' }}>
            <b>+{gained}</b>
            <span>XP</span>
          </div>
          <div style={{ background: 'var(--coral-soft)' }}>
            <b>{stats.streak}</b>
            <span>дн. серия</span>
          </div>
          <div style={{ background: 'var(--mint-soft)' }}>
            <b>×{(pd?.multiplier ?? 1).toFixed(1)}</b>
            <span>множитель</span>
          </div>
        </div>
        {pd?.record && <span className="chip chip-sun">Новый рекорд по паразитам!</span>}
        <div className="stack" style={{ width: '100%', gap: 6 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>
              Ур. {lv.index + 1} · {lv.name}
            </b>
            {lv.next && <span className="small muted">до «{lv.next.name}» {lv.next.min - stats.xp} XP</span>}
          </div>
          <Bar value={lv.next ? (stats.xp - lv.min) / (lv.next.min - lv.min) : 1} color="var(--sun)" />
        </div>
        <p className="small">Хочешь ещё? Лимита нет — практика ждёт.</p>
        <div className="row" style={{ width: '100%' }}>
          <Link href="/" className="btn" style={{ flex: 1 }}>
            На главную
          </Link>
          <Link href="/practice" className="btn btn-primary" style={{ flex: 1 }}>
            Ещё практика
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="stack-lg">
      {last ? (
        <div className="card card-tint" style={{ ['--tint' as string]: 'var(--sky-soft)' }}>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <Mascot mood="coach" size={48} />
            <p className="small">
              Подставил цифры из разбора дубля {last.take_no}. Поправь, если не согласен.
            </p>
          </div>
        </div>
      ) : (
        <p className="muted">Пересмотри второй дубль и честно посчитай. Или вернись к шагу 3 и запиши дубль — разбор подставит цифры сам.</p>
      )}

      <div className="card">
        <span className="label">Сколько раз «э / ну / типа / вот / короче»</span>
        <div className={s.stepper}>
          <button className="btn btn-icon" aria-label="Меньше" onClick={() => setFillers((v) => Math.max(0, v - 1))}>
            −
          </button>
          <b>{fillers}</b>
          <button className="btn btn-icon" aria-label="Больше" onClick={() => setFillers((v) => v + 1)}>
            <Icon name="plus" size={18} />
          </button>
        </div>
      </div>

      <div className="card">
        <span className="label">Насколько понятно с первого раза</span>
        <div className={s.scale}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} aria-pressed={clarity === n} onClick={() => setClarity(n)}>
              {n}
            </button>
          ))}
        </div>
        <div className="row small muted" style={{ justifyContent: 'space-between' }}>
          <span>каша</span>
          <span>чётко</span>
        </div>
      </div>

      {challenge && (
        <label className="card" style={{ flexDirection: 'row', alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={chDone} onChange={(e) => setChDone(e.target.checked)} style={{ width: 24, height: 24, accentColor: 'var(--mint)' }} />
          <span>
            <b>Челлендж выполнен</b>
            <br />
            <span className="small muted">{challenge.title}</span>
          </span>
        </label>
      )}

      <div className="card">
        <label className="label" htmlFor="note">
          Где ушёл в сторону и почему
        </label>
        <textarea id="note" className="input" maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Например: на примере начал рассказывать вторую историю" />
      </div>

      <button className="btn btn-mint btn-lg btn-block" onClick={save}>
        {session.saved_at ? 'Обновить итог дня' : 'Сохранить день'}
      </button>
    </div>
  );
}
