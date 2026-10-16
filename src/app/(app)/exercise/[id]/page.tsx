'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/client/store';
import type { Exercise, Frame, PlanItem, Take, TakeContext } from '@/domain/types';
import { FRAMES, TOPICS, TWISTERS, getChallenge, getFrame, getTopicText } from '@/domain/content';
import { getExercise } from '@/domain/exercises';
import { levelFor, prepSecondsFor } from '@/domain/gamification/levels';
import { problemInfo } from '@/domain/problems/catalog';
import { Icon } from '@/components/ui/Icon';
import { Mascot } from '@/components/ui/Mascot';
import { CATEGORY } from '@/components/practice/ExerciseCard';
import { Timer } from '@/components/exercise/Timer';
import { SpeakingFlow } from '@/components/exercise/SpeakingFlow';
import { SaveDay } from '@/components/exercise/SaveDay';
import s from '@/components/exercise/exercise.module.css';

const COLORS = ['var(--coral)', 'var(--sky)', 'var(--mint)', 'var(--lilac)', 'var(--sun)'];

type Resolved = {
  kind: 'ritual' | 'library' | 'plan' | 'free';
  ritualStep?: number;
  ex: Exercise;
  plan?: PlanItem;
};

function freeExercise(): Exercise {
  return {
    id: 'free',
    title: 'Свободный дубль',
    category: 'impro',
    minutes: 3,
    targets: [],
    speaking: true,
    take_s: 90,
    prep_s: 30,
    needs_topic: true,
    instructions: ['Выбери тему или впиши свою.', 'Начни с вывода одной фразой.', 'Хочешь сказать «э» — замолчи на секунду.'],
    success: 'Вывод в первой фразе и меньше паразитов, чем в прошлый раз.',
  };
}

export default function ExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const app = useApp();
  const { session, state, stats, patchSession, toggleStep, addActivity, markPlanDone, toast } = app;
  const openedAt = useRef(0);
  useEffect(() => {
    openedAt.current = Date.now();
  }, []);

  const r = useMemo<Resolved | null>(() => {
    if (id === 'free') return { kind: 'free', ex: freeExercise() };
    if (id.startsWith('ritual-')) {
      const ex = getExercise(id);
      return ex ? { kind: 'ritual', ritualStep: Number(id.slice(7)), ex } : null;
    }
    if (id.startsWith('plan-')) {
      const item = state.plan?.items.find((x) => x.id === id.slice(5));
      if (!item) return null;
      const base = item.base_exercise_id ? getExercise(item.base_exercise_id) : undefined;
      const ex: Exercise = {
        id,
        title: item.title,
        category: base?.category ?? 'impro',
        minutes: item.minutes,
        targets: item.targets,
        speaking: item.speaking,
        take_s: item.take_s ?? 90,
        prep_s: base?.prep_s ?? 20,
        instructions: item.instructions,
        success: item.success,
        needs_topic: item.speaking,
        needs_frame: !!item.frame_id,
      };
      return { kind: 'plan', ex, plan: item };
    }
    const ex = getExercise(id);
    return ex ? { kind: 'library', ex } : null;
  }, [id, state.plan]);

  const lv = levelFor(stats.xp).index;
  const isMainTake = r?.kind === 'ritual' && r.ritualStep === 2;
  const surprise = isMainTake && lv >= 5 && !session.saved_at;
  const [revealed, setRevealed] = useState(!surprise);

  // тема
  const [topicIdx, setTopicIdx] = useState(() => (Number(id.length) * 7 + new Date().getDate() * 3) % TOPICS.length);
  const [custom, setCustom] = useState('');
  const [editTopic, setEditTopic] = useState(false);
  const topic: string | null = !r?.ex.needs_topic
    ? null
    : isMainTake
      ? (session.custom_topic ?? getTopicText(session.topic_id) ?? null)
      : r?.plan?.topic
        ? r.plan.topic
        : custom.trim() || TOPICS[topicIdx]?.text || null;

  // каркас
  const [frameId, setFrameId] = useState<string | null>(null);
  const frame: Frame | undefined =
    getFrame(frameId) ?? (r?.plan?.frame_id ? getFrame(r.plan.frame_id) : r?.ex.needs_frame || isMainTake ? getFrame(session.frame_id) : undefined);

  const challenge = r?.kind === 'ritual' && isMainTake ? getChallenge(session.challenge_id) : undefined;
  const [analyzed, setAnalyzed] = useState(0);
  const onAnalyzed = useCallback((t: Take) => {
    void t;
    setAnalyzed((n) => n + 1);
  }, []);

  if (!r) {
    return (
      <main className={s.page}>
        <Mascot mood="sad" size={90} />
        <h1>Упражнение не найдено</h1>
        <Link href="/practice" className="btn btn-primary">
          К практике
        </Link>
      </main>
    );
  }

  const { ex } = r;
  const step = r.ritualStep;
  const stepDone = step !== undefined && session.steps_done.includes(step);
  const planDone = r.plan ? state.plan?.done.includes(r.plan.id) : false;
  const cat = CATEGORY[ex.category];
  const context: TakeContext = r.kind === 'ritual' ? 'ritual' : r.kind === 'plan' ? 'plan' : r.kind === 'library' ? 'drill' : 'free';
  const prep = isMainTake ? prepSecondsFor(lv) : (ex.prep_s ?? 0);

  function complete() {
    if (!r) return;
    if (r.kind === 'ritual' && step !== undefined) {
      if (!stepDone) toggleStep(step);
      router.push('/');
      return;
    }
    if (r.kind === 'free') {
      router.push('/');
      return;
    }
    const elapsed = Math.round((Date.now() - openedAt.current) / 1000);
    const duration = Math.max(60, Math.min(elapsed, ex.minutes * 60 * 3));
    addActivity({
      kind: 'drill',
      ref: r.kind === 'plan' ? `plan:${r.plan!.id}` : ex.id,
      duration_s: duration,
      meta: r.kind === 'plan' ? { plan: true } : {},
    });
    if (r.plan) markPlanDone(r.plan.id);
    toast(`+${duration >= 300 ? 15 : 10} XP · ${Math.round(duration / 60)} мин в копилку`, 'mint');
    router.push('/practice');
  }

  return (
    <main className={s.page}>
      <div className={s.head}>
        <button className="btn btn-icon" aria-label="Назад" onClick={() => router.back()}>
          <Icon name="x" />
        </button>
        <div className="row" style={{ gap: 6 }}>
          <span className="chip" style={{ background: cat.color, color: '#fff' }}>
            <Icon name={cat.icon} size={14} /> {cat.title}
          </span>
          <span className="chip">{ex.minutes} мин</span>
          {ex.speaking && <span className="chip chip-sky">запись</span>}
        </div>
      </div>

      <div className={s.title}>
        <h1>{ex.title}</h1>
        {r.plan?.why && (
          <p className="small" style={{ fontWeight: 600 }}>
            <span className="chip chip-lilac">Почему тебе</span> {r.plan.why}
          </p>
        )}
        {ex.targets.length > 0 && !r.plan && (
          <p className="small muted">Работает против: {ex.targets.map((t) => problemInfo(t)?.title.toLowerCase()).join(', ')}</p>
        )}
      </div>

      {/* особые шаги ритуала */}
      {step === 0 && <Twister />}

      {ex.instructions.length > 0 && step !== 3 && (
        <ol className={`${s.instr} card card-flat`}>
          {ex.instructions.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>
      )}

      {step === 1 && <Breath />}

      {ex.needs_topic && (
        <section className="stack">
          <span className="label">Тема</span>
          {isMainTake && !revealed ? (
            <div className={s.topic} data-hidden="true">
              Тема-сюрприз откроется, когда нажмёшь «Подготовка» или «Записать».
            </div>
          ) : editTopic ? (
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input
                className="input"
                autoFocus
                placeholder="Своя тема"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setEditTopic(false)}
              />
              <button
                className="btn btn-icon"
                aria-label="Готово"
                onClick={() => {
                  setEditTopic(false);
                  if (isMainTake && custom.trim()) patchSession({ custom_topic: custom.trim() });
                }}
              >
                <Icon name="check" />
              </button>
            </div>
          ) : (
            <div className={s.topic}>{topic}</div>
          )}
          {!r.plan?.topic && (revealed || !isMainTake) && (
            <div className="row">
              <button
                className="btn btn-sm"
                onClick={() => {
                  if (isMainTake) {
                    const i = Math.max(0, TOPICS.findIndex((t) => t.id === session.topic_id));
                    patchSession({ topic_id: TOPICS[(i + 1) % TOPICS.length].id, custom_topic: null });
                  } else {
                    setCustom('');
                    setTopicIdx((i) => (i + 1) % TOPICS.length);
                  }
                }}
              >
                <Icon name="refresh" size={16} /> Другая тема
              </button>
              <button className="btn btn-sm" onClick={() => setEditTopic(true)}>
                <Icon name="edit" size={16} /> Своя
              </button>
            </div>
          )}
        </section>
      )}

      {(frame || ex.needs_frame || r.kind === 'free') && ex.speaking && (
        <section className="stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="label">Каркас{frame ? `: ${frame.name}` : ''}</span>
            {!isMainTake && (
              <select
                className="chip"
                value={frame?.id ?? ''}
                onChange={(e) => setFrameId(e.target.value || null)}
                aria-label="Выбрать каркас"
              >
                <option value="">без каркаса</option>
                {FRAMES.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          {frame && (
            <div className={s.frame}>
              {frame.points.map((pt, i) => (
                <div key={pt.id} className={s.point}>
                  <b style={{ background: COLORS[i % COLORS.length] }}>{pt.mark}</b>
                  {pt.text}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {challenge && (
        <div className="card card-tint">
          <span className="label" style={{ color: 'var(--fg)' }}>
            Челлендж дня
          </span>
          <b>{challenge.title}</b>
          <span className="small muted">{challenge.hint}</span>
        </div>
      )}

      {step === 3 ? (
        <SaveDay />
      ) : (
        <>
          {(prep > 0 || !ex.speaking) && (
            <Timer
              key={ex.id}
              presets={
                ex.speaking
                  ? [{ label: `Подготовка 0:${String(prep).padStart(2, '0')}`, s: prep }]
                  : [{ label: `${ex.minutes} мин`, s: ex.minutes * 60 }, { label: '1 мин', s: 60 }]
              }
              onStart={() => setRevealed(true)}
            />
          )}

          {ex.speaking && (
            <SpeakingFlow
              context={context}
              exerciseId={ex.id}
              topic={topic}
              frame={frame}
              challengeId={challenge?.id ?? null}
              challengeTitle={challenge?.title}
              takeSeconds={Math.min(150, ex.take_s ?? 90)}
              onAnalyzed={onAnalyzed}
              onBeforeRecord={() => setRevealed(true)}
            />
          )}

          <div className="card card-flat" style={{ background: 'var(--bg-2)' }}>
            <span className="label">Критерий успеха</span>
            <p className="small" style={{ fontWeight: 600 }}>
              {ex.success}
            </p>
          </div>

          <div className={s.done}>
            {r.kind === 'free' ? (
              <button className="btn btn-block btn-lg" onClick={complete}>
                Закончить
              </button>
            ) : (
              <button className={`btn btn-block btn-lg ${stepDone || planDone ? '' : 'btn-mint'}`} onClick={complete} disabled={ex.speaking && analyzed === 0 && r.kind !== 'ritual'}>
                <Icon name="check" /> {stepDone || planDone ? 'Уже выполнено — назад' : ex.speaking && analyzed === 0 && r.kind !== 'ritual' ? 'Сначала запиши дубль' : 'Готово'}
              </button>
            )}
          </div>
        </>
      )}
    </main>
  );
}

function Twister() {
  const { session, patchSession } = useApp();
  const idx = Math.max(0, TWISTERS.findIndex((t) => t.id === session.twister_id));
  const tw = TWISTERS[idx];
  return (
    <section className="stack">
      <span className="label">Скороговорка дня</span>
      <p className={s.twister}>{tw?.text}</p>
      <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => patchSession({ twister_id: TWISTERS[(idx + 1) % TWISTERS.length].id })}>
        <Icon name="refresh" size={16} /> Другая скороговорка
      </button>
    </section>
  );
}

function Breath() {
  const { session, state, today, patchSession, toast } = useApp();
  const best = Math.max(0, ...state.sessions.filter((x) => x.date !== today && x.breath != null).map((x) => x.breath as number));
  const [v, setV] = useState<string>(session.breath != null ? String(session.breath) : '');
  return (
    <div className="card">
      <span className="label">На одном выдохе досчитал до</span>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input
          className="input"
          type="number"
          inputMode="numeric"
          min={0}
          value={v}
          placeholder="0"
          style={{ maxWidth: 120, fontFamily: 'var(--display)', fontWeight: 800 }}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => {
            const n = Number(v) || 0;
            if (n === (session.breath ?? 0)) return;
            patchSession({ breath: n });
            if (best && n > best) toast(`Новый рекорд выдоха: ${n}`, 'sun');
          }}
        />
        {best > 0 && <span className="small muted">рекорд: {best}</span>}
      </div>
    </div>
  );
}
