'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';

let actx: AudioContext | null = null;
export function chime(f = 660, len = 0.18) {
  try {
    actx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.frequency.value = f;
    g.gain.setValueAtTime(0.12, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + len);
    o.connect(g);
    g.connect(actx.destination);
    o.start();
    o.stop(actx.currentTime + len);
  } catch {}
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.ceil(s) % 60)).padStart(2, '0')}`;

/** Таймер по времени окончания (переживает уход в фон). presets — кнопки длительностей. */
export function Timer({ presets, onStart, onEnd }: { presets: { label: string; s: number }[]; onStart?: (s: number) => void; onEnd?: () => void }) {
  const [total, setTotal] = useState(presets[0]?.s ?? 60);
  const [endAt, setEndAt] = useState<number | null>(null);
  const [left, setLeft] = useState(total);
  const lastBeep = useRef(0);

  useEffect(() => {
    if (!endAt) return;
    const tick = () => {
      const l = Math.max(0, (endAt - Date.now()) / 1000);
      setLeft(l);
      const sec = Math.ceil(l);
      if (sec <= 3 && sec > 0 && sec !== lastBeep.current) {
        lastBeep.current = sec;
        chime(520, 0.06);
      }
      if (l <= 0) {
        setEndAt(null);
        chime(880, 0.4);
        onEnd?.();
      }
    };
    tick();
    const iv = setInterval(tick, 200);
    return () => clearInterval(iv);
  }, [endAt, onEnd]);

  const running = endAt !== null;
  return (
    <div className="card" style={{ gap: 10 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <span className="num" style={{ fontSize: 40, fontWeight: 800, color: left === 0 ? 'var(--coral)' : undefined }}>
          {fmt(left)}
        </span>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <button
            className={`btn ${running ? '' : 'btn-sun'}`}
            onClick={() => {
              if (running) {
                setEndAt(null);
                return;
              }
              const l = left > 0 ? left : total;
              setLeft(l);
              lastBeep.current = 0;
              setEndAt(Date.now() + l * 1000);
              chime(440, 0.1);
              onStart?.(total);
            }}
          >
            <Icon name={running ? 'pause' : 'play'} size={18} /> {running ? 'Пауза' : 'Старт'}
          </button>
          <button
            className="btn btn-icon"
            aria-label="Сброс"
            onClick={() => {
              setEndAt(null);
              setLeft(total);
            }}
          >
            <Icon name="refresh" size={18} />
          </button>
        </div>
      </div>
      {presets.length > 1 && (
        <div className="seg">
          {presets.map((p) => (
            <button
              key={p.label}
              aria-pressed={total === p.s}
              onClick={() => {
                setTotal(p.s);
                setLeft(p.s);
                setEndAt(null);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
