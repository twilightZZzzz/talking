'use client';

import { useEffect, useRef } from 'react';
import { useRecorder, type RecorderResult } from '@/client/media';
import type { Frame } from '@/domain/types';
import { Icon } from '@/components/ui/Icon';
import { Mascot } from '@/components/ui/Mascot';
import s from './exercise.module.css';

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

/** Полноэкранная запись дубля: превью фронталки, кольцо-таймер, подсказка пункта каркаса. */
export function Recorder({
  maxSeconds,
  frame,
  challenge,
  audioOnly,
  onDone,
  onCancel,
}: {
  maxSeconds: number;
  frame?: Frame;
  challenge?: string;
  audioOnly?: boolean;
  onDone: (r: RecorderResult) => void;
  onCancel: () => void;
}) {
  const rec = useRecorder({ maxSeconds, facingMode: 'user', audioOnly });
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (video.current && rec.stream) video.current.srcObject = rec.stream;
  }, [rec.stream]);

  useEffect(() => {
    if (rec.state === 'stopped' && rec.result) onDone(rec.result);
  }, [rec.state, rec.result, onDone]);

  const left = Math.max(0, maxSeconds - rec.elapsed);
  const p = Math.min(1, rec.elapsed / maxSeconds);
  const points = frame?.points ?? [];
  const pointIdx = points.length ? Math.min(points.length - 1, Math.floor(p * points.length)) : -1;
  const recording = rec.state === 'recording';
  const R = 44;
  const C = 2 * Math.PI * R;

  return (
    <div className={s.recWrap} role="dialog" aria-label="Запись дубля">
      <div className={s.preview}>
        {!audioOnly && rec.stream ? (
          <video ref={video} className={s.video} data-mirror={rec.facing === 'user'} muted playsInline autoPlay />
        ) : (
          <div className={s.audioOnly}>
            <Mascot mood={recording ? 'coach' : 'happy'} size={120} bob={recording} />
          </div>
        )}
        <div className={s.recTop}>
          {recording ? (
            <span className={s.recDot}>● Запись</span>
          ) : (
            <span className="chip">{rec.state === 'requesting' ? 'Включаю камеру…' : 'Готов'}</span>
          )}
          <span className={s.recClock}>
            {fmt(rec.elapsed)} / {fmt(maxSeconds)}
          </span>
        </div>
        {(pointIdx >= 0 || challenge) && (
          <div className={s.hint}>
            {pointIdx >= 0 && (
              <>
                <span className="label">{recording ? 'Сейчас' : 'Начни с'}</span>
                <b>{points[pointIdx].text}</b>
                <span className={s.dots}>
                  {points.map((pt, i) => (
                    <i key={pt.id} data-on={i <= pointIdx} />
                  ))}
                </span>
              </>
            )}
            {challenge && <span className="chip chip-sun">Челлендж: {challenge}</span>}
          </div>
        )}
        {rec.state === 'error' && (
          <div className={s.recError} role="alert">
            <Mascot mood="sad" size={60} />
            <p>{rec.error}</p>
            <button className="btn btn-primary btn-sm" onClick={() => void rec.reset()}>
              Попробовать снова
            </button>
          </div>
        )}
      </div>

      <div className={s.recControls}>
        <button
          className="btn btn-icon"
          aria-label="Отмена"
          onClick={() => {
            rec.cancel();
            onCancel();
          }}
        >
          <Icon name="x" />
        </button>
        <button
          className={s.bigRec}
          data-rec={recording}
          disabled={rec.state === 'requesting' || rec.state === 'error'}
          aria-label={recording ? 'Остановить запись' : 'Начать запись'}
          onClick={() => {
            // start() — прямо в обработчике касания, иначе iOS не запустит звук
            if (recording) void rec.stop();
            else void rec.start();
          }}
        >
          <svg viewBox="0 0 100 100" className={s.ring} aria-hidden>
            <circle cx="50" cy="50" r={R} fill="none" stroke="var(--line)" strokeWidth="6" />
            {p > 0 && <circle
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke="var(--berry)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${C * p} ${C}`}
              transform="rotate(-90 50 50)"
            />}
          </svg>
          <span className={s.recCore}>{recording ? <Icon name="stop" size={30} /> : <Icon name="mic" size={30} />}</span>
        </button>
        <button className="btn btn-icon" aria-label="Сменить камеру" disabled={audioOnly || rec.state !== 'ready'} onClick={() => void rec.flip()}>
          <Icon name="flip" />
        </button>
      </div>
      <p className="small muted" style={{ textAlign: 'center' }}>
        {recording ? `Осталось ${fmt(left)}. Хочешь сказать «э» — замолчи.` : audioOnly ? 'Пишем только звук' : 'Видео остаётся на устройстве. На разбор уходит только звук.'}
      </p>
    </div>
  );
}
