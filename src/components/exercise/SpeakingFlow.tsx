'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { StageError, extractAudioFromFile, runAnalysis, uploadTake, type RecorderResult, type Stage } from '@/client/media';
import { useApp, uuid } from '@/client/store';
import type { Frame, Take, TakeContext } from '@/domain/types';
import { Mascot } from '@/components/ui/Mascot';
import { Icon } from '@/components/ui/Icon';
import { Recorder } from './Recorder';
import { TakeReview } from './TakeReview';
import s from './exercise.module.css';

type Phase = 'idle' | 'record' | 'work' | 'review' | 'error';

interface Props {
  context: TakeContext;
  exerciseId: string | null;
  topic: string | null;
  frame?: Frame;
  challengeId?: string | null;
  challengeTitle?: string;
  takeSeconds: number;
  /** вызывается после успешного разбора */
  onAnalyzed?: (t: Take) => void;
  /** перед записью (например, раскрыть тему-сюрприз) */
  onBeforeRecord?: () => void;
}

const STAGES: { key: Stage; title: string }[] = [
  { key: 'upload', title: 'Загружаю звук' },
  { key: 'transcribe', title: 'Распознаю речь' },
  { key: 'feedback', title: 'Готовлю разбор' },
];

/** Дубль: запись (или файл) → загрузка → распознавание → разбор → карточка. Можно повторять сколько угодно. */
export function SpeakingFlow(p: Props) {
  const { today, upsertTake, state, toast, reload } = useApp();
  const [phase, setPhase] = useState<Phase>('idle');
  const [stage, setStage] = useState<Stage>('upload');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [take, setTake] = useState<Take | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioOnly, setAudioOnly] = useState(false);
  const [pending, setPending] = useState<{ id: string; from?: 'feedback' } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const [prevTake, setPrevTake] = useState<Take | null>(null);

  useEffect(() => () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

  const analyze = useCallback(
    async (id: string, from?: 'feedback') => {
      setPhase('work');
      setError(null);
      try {
        const t = await runAnalysis(id, (st) => setStage(st), from ? { from } : undefined);
        setPrevTake(take);
        setTake(t);
        upsertTake(stripWords(t));
        setPhase('review');
        p.onAnalyzed?.(t);
        // XP, минуты и профиль проблем считаются из activities/events — подтягиваем свежие с сервера
        void reload();
        setPending(null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Что-то пошло не так';
        setError(msg);
        setPhase('error');
        // тишину/пустую запись повторять бессмысленно
        const silent = e instanceof StageError && e.stage === 'transcribe' && /не слышно/i.test(msg);
        setPending(silent ? null : { id, from: e instanceof StageError && e.stage === 'feedback' ? 'feedback' : undefined });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [take, upsertTake, p.onAnalyzed, reload],
  );

  const submit = useCallback(
    async (audio: Blob, mime: string, duration: number, source: 'record' | 'upload', vUrl: string | null) => {
      if (duration < 3) {
        toast('Слишком коротко — нужна хотя бы пара фраз');
        setPhase(take ? 'review' : 'idle');
        return;
      }
      if (videoUrl && videoUrl !== vUrl) URL.revokeObjectURL(videoUrl);
      setVideoUrl(vUrl);
      const id = uuid();
      setPending({ id });
      setPhase('work');
      setStage('upload');
      setProgress(0);
      setError(null);
      try {
        await uploadTake({
          id,
          session_date: today,
          context: p.context,
          exercise_id: p.exerciseId ?? undefined,
          topic: p.topic ?? undefined,
          frame_id: p.frame?.id,
          challenge_id: p.challengeId ?? undefined,
          source,
          audioBlob: audio,
          audioMime: mime,
          duration_s: Math.round(duration * 10) / 10,
          onProgress: setProgress,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Не удалось загрузить звук');
        setPhase('error');
        setPending(null);
        return;
      }
      await analyze(id);
    },
    [today, p.context, p.exerciseId, p.topic, p.frame, p.challengeId, analyze, take, toast, videoUrl],
  );

  const onRecorded = useCallback(
    (r: RecorderResult) => void submit(r.audioBlob, r.audioMime, r.duration_s, 'record', r.videoUrl),
    [submit],
  );

  async function onFile(f: File) {
    setPhase('work');
    setStage('upload');
    setProgress(0);
    try {
      const r = await extractAudioFromFile(f, { maxSeconds: 150 });
      await submit(r.audioBlob, 'audio/wav', r.duration_s, 'upload', r.videoUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось прочитать файл');
      setPhase('error');
    }
  }

  async function exclude(i: number) {
    if (!take) return;
    const next = [...take.fillers_excluded, i];
    setTake({ ...take, fillers_excluded: next });
    try {
      const r = await fetch(`/api/takes/${take.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fillers_excluded: next }),
      });
      if (r.ok) {
        const j = await r.json();
        const t = (j.take ?? j) as Take;
        setTake(t);
        upsertTake(stripWords(t));
      }
    } catch {}
  }

  const previous = take ? prevTake ?? lastTakeToday(state.takes, today, take.id) : null;

  return (
    <div className="stack-lg">
      {phase === 'record' && (
        <Recorder
          maxSeconds={p.takeSeconds}
          frame={p.frame}
          challenge={p.challengeTitle}
          audioOnly={audioOnly}
          onDone={onRecorded}
          onCancel={() => setPhase(take ? 'review' : 'idle')}
        />
      )}

      {phase === 'work' && (
        <div className={`card ${s.work}`}>
          <Mascot mood="think" size={90} bob />
          <h2>Разбираю дубль…</h2>
          <ol className={s.stages}>
            {STAGES.map((st, i) => {
              const cur = STAGES.findIndex((x) => x.key === stage);
              const state = i < cur || stage === 'done' ? 'done' : i === cur ? 'now' : 'wait';
              return (
                <li key={st.key} data-s={state}>
                  <span className={s.stageDot}>{state === 'done' ? <Icon name="check" size={16} /> : state === 'now' ? <i className={s.spinner} /> : i + 1}</span>
                  {st.title}
                  {st.key === 'upload' && state === 'now' && progress > 0 && <span className="small muted"> {Math.round(progress * 100)}%</span>}
                </li>
              );
            })}
          </ol>
          <p className="small muted">Обычно 10–30 секунд. Не закрывай страницу.</p>
        </div>
      )}

      {phase === 'error' && (
        <div className={`card ${s.work}`} role="alert">
          <Mascot mood="sad" size={80} />
          <p style={{ fontWeight: 700 }}>{error}</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            {pending && (
              <button className="btn btn-primary" onClick={() => void analyze(pending.id, pending.from)}>
                Повторить разбор
              </button>
            )}
            <button className="btn" onClick={() => setPhase('record')}>
              Записать заново
            </button>
          </div>
        </div>
      )}

      {phase === 'review' && take && (
        <>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2>Разбор дубля {take.take_no}</h2>
            <span className="chip">{Math.round(take.duration_s ?? 0)} сек</span>
          </div>
          <TakeReview take={take} videoUrl={videoUrl} previous={previous} onExclude={exclude} />
        </>
      )}

      {(phase === 'idle' || phase === 'review') && (
        <div className="stack">
          <button
            className="btn btn-primary btn-lg btn-block"
            onClick={() => {
              p.onBeforeRecord?.();
              setAudioOnly(false);
              setPhase('record');
            }}
          >
            <span className={s.recIcon} /> {take ? 'Ещё дубль' : 'Записать дубль'}
          </button>
          <div className="row">
            <button
              className="btn btn-sm"
              style={{ flex: 1 }}
              onClick={() => {
                p.onBeforeRecord?.();
                setAudioOnly(true);
                setPhase('record');
              }}
            >
              <Icon name="mic" size={16} /> Только звук
            </button>
            <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => file.current?.click()}>
              <Icon name="upload" size={16} /> Видео из галереи
            </button>
            <input
              ref={file}
              type="file"
              accept="video/*,audio/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void onFile(f);
              }}
            />
          </div>
          {state.aiStatus.llm === 'mock' && (
            <p className="small muted" style={{ textAlign: 'center' }}>
              Демо-режим ИИ: ключи не заданы, разбор — пример. См. Профиль → ИИ.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function stripWords(t: Take) {
  const { words: _w, transcript: _t, ...rest } = t;
  void _w;
  void _t;
  return rest;
}

function lastTakeToday(takes: { id: string; session_date: string; status: string; created_at: string; metrics: Take['metrics'] }[], today: string, exceptId: string) {
  const list = takes
    .filter((t) => t.session_date === today && t.status === 'done' && t.id !== exceptId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (list[0] as never) ?? null;
}
