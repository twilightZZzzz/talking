'use client';

import { useRef, useState } from 'react';
import type { Take, TakeSummary } from '@/domain/types';
import { getFrame } from '@/domain/content';
import { problemInfo } from '@/domain/problems/catalog';
import { Icon } from '@/components/ui/Icon';
import { Mascot } from '@/components/ui/Mascot';
import s from './review.module.css';

const t2s = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export function TakeReview({
  take,
  videoUrl,
  previous,
  onExclude,
}: {
  take: Take;
  videoUrl?: string | null;
  previous?: TakeSummary | null;
  onExclude?: (wordIndex: number) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [showText, setShowText] = useState(false);
  const m = take.metrics;
  const f = take.feedback;
  if (!m || !f) return null;
  const fillers = m.fillers.filter((x) => !x.doubtful && !take.fillers_excluded.includes(x.i));
  const doubtful = m.fillers.filter((x) => x.doubtful && !take.fillers_excluded.includes(x.i));
  const prevFpm = previous?.metrics?.fpm;
  const delta = prevFpm != null ? Math.round((m.fpm - prevFpm) * 10) / 10 : null;
  const paceZone = m.wpm < 105 ? 'slow' : m.wpm > 165 ? 'fast' : m.wpm >= 120 && m.wpm <= 150 ? 'ok' : 'near';
  const frame = getFrame(take.frame_id);

  const seek = (t: number) => {
    if (!video.current) return;
    video.current.currentTime = Math.max(0, t - 1);
    void video.current.play();
  };

  return (
    <div className="stack-lg rise">
      {videoUrl && <video ref={video} src={videoUrl} className={s.video} controls playsInline data-mirror="true" />}

      <div className={s.tiles}>
        <div className={s.tile} style={{ ['--c' as string]: 'var(--berry)' }}>
          <b className="num">{m.fillers_count}</b>
          <span>паразит{plural(m.fillers_count, '', 'а', 'ов')}</span>
          <em>{m.fpm}/мин</em>
          {delta !== null && delta !== 0 && (
            <small className={s.delta} data-good={delta < 0}>
              {delta < 0 ? '↓' : '↑'} {Math.abs(delta)}/мин к прошлому
            </small>
          )}
        </div>
        <div className={s.tile} style={{ ['--c' as string]: paceZone === 'ok' ? 'var(--mint)' : paceZone === 'near' ? 'var(--sky)' : 'var(--coral)' }}>
          <b className="num">{m.wpm}</b>
          <span>слов/мин</span>
          <em>{paceZone === 'ok' ? 'в зоне 120–150' : paceZone === 'fast' ? 'тараторишь' : paceZone === 'slow' ? 'медленно' : 'почти в зоне'}</em>
        </div>
        <div className={s.tile} style={{ ['--c' as string]: 'var(--sky)' }}>
          <b className="num">{m.pauses.length}</b>
          <span>пауз</span>
          <em>{m.pauses_per_min}/мин</em>
        </div>
        <div className={s.tile} style={{ ['--c' as string]: 'var(--sun)' }}>
          <b className="num">{f.clarity ?? '—'}</b>
          <span>ясность</span>
          <em>из 5</em>
        </div>
      </div>

      {f.clarity_reason && <p className="small muted">{f.clarity_reason}</p>}

      {f.strengths?.length > 0 && (
        <section className={`card ${s.good}`}>
          <h3 className={s.h}>
            <Icon name="star" size={20} /> Получилось
          </h3>
          <ul>
            {f.strengths.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </section>
      )}

      <section className={`card ${s.main}`}>
        <h3 className={s.h}>Главное, что мешает</h3>
        <p className={s.big}>{f.main_issue}</p>
      </section>

      <section className={`card ${s.task}`}>
        <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
          <Mascot mood="coach" size={52} />
          <div className="stack" style={{ gap: 4 }}>
            <h3 className={s.h}>Задание на следующий дубль</h3>
            <p className={s.big}>{f.next_task}</p>
          </div>
        </div>
      </section>

      <section className="card">
        <h3 className={s.h}>Первая фраза</h3>
        {f.opening.quote && <blockquote className={s.quote}>«{f.opening.quote}»</blockquote>}
        <p className="small">
          {f.opening.is_conclusion === true ? '✓ ' : f.opening.is_conclusion === false ? '✗ ' : ''}
          {f.opening.comment}
        </p>
        {f.rewrite_opening && (
          <div className={s.rewrite}>
            <span className="label">Сильнее так</span>
            <p>«{f.rewrite_opening}»</p>
          </div>
        )}
      </section>

      {f.frame.length > 0 && (
        <section className="card">
          <h3 className={s.h}>Каркас{frame ? `: ${frame.name}` : ''}</h3>
          <ul className={s.frameList}>
            {f.frame.map((pt, i) => (
              <li key={i} data-ok={pt.present}>
                <span className={s.mark}>{pt.present ? '✓' : '✗'}</span>
                <span>
                  <b>{pt.point}</b>
                  {pt.quote ? <span className="small muted"> — «{pt.quote}»</span> : null}
                  {pt.comment ? <span className="small"> {pt.comment}</span> : null}
                </span>
              </li>
            ))}
          </ul>
          {f.frame_order_ok === false && <p className="small">⚠ Порядок пунктов сбит.</p>}
        </section>
      )}

      <section className="card">
        <h3 className={s.h}>
          Паразиты <span className="small muted">· нажми, чтобы услышать{onExclude ? ', ✕ — это не паразит' : ''}</span>
        </h3>
        {fillers.length === 0 ? (
          <p className="small">Ни одного. Так держать.</p>
        ) : (
          <div className={s.chips}>
            {fillers.map((x) => (
              <span key={x.i} className={s.filler}>
                <button onClick={() => seek(x.t)} disabled={!videoUrl}>
                  <b>{x.word}</b> {t2s(x.t)}
                </button>
                {onExclude && (
                  <button className={s.ex} aria-label={`«${x.word}» — не паразит`} onClick={() => onExclude(x.i)}>
                    ✕
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
        {doubtful.length > 0 && (
          <p className="small muted">
            Спорные, не считаю: {doubtful.map((x) => `«${x.word}» ${t2s(x.t)}`).join(', ')}
          </p>
        )}
      </section>

      {f.detours.length > 0 && (
        <section className="card">
          <h3 className={s.h}>Уходы в сторону</h3>
          {f.detours.map((d, i) => (
            <button key={i} className={s.detour} onClick={() => seek(d.t)} disabled={!videoUrl}>
              <span className="chip chip-coral">{t2s(d.t)}</span>
              <span>
                «{d.quote}» <span className="small muted">— {d.comment}</span>
              </span>
            </button>
          ))}
        </section>
      )}

      {take.challenge_id && (
        <section className="card card-tint">
          <h3 className={s.h}>
            Челлендж: {f.challenge.done === true ? 'выполнен ✓' : f.challenge.done === false ? 'не выполнен' : 'оцени сам'}
          </h3>
          <p className="small">{f.challenge.comment}</p>
        </section>
      )}

      {f.issues.length > 0 && (
        <section className="card">
          <h3 className={s.h}>Записал в твой профиль</h3>
          <div className={s.chips}>
            {f.issues.map((x, i) => (
              <span key={i} className="chip chip-lilac" title={x.comment}>
                {problemInfo(x.code)?.title ?? x.code}
                {' '}
                {'●'.repeat(x.severity)}
              </span>
            ))}
          </div>
        </section>
      )}

      {f.vs_previous && <p className="small muted">По сравнению с прошлым дублем: {f.vs_previous}</p>}

      {take.transcript && (
        <section className="card card-flat">
          <button className="btn btn-ghost btn-sm" onClick={() => setShowText((v) => !v)} style={{ alignSelf: 'flex-start' }}>
            {showText ? 'Скрыть текст' : 'Показать расшифровку'}
          </button>
          {showText && <Transcript take={take} />}
        </section>
      )}
    </div>
  );
}

function Transcript({ take }: { take: Take }) {
  const hits = new Map((take.metrics?.fillers ?? []).filter((x) => !take.fillers_excluded.includes(x.i)).map((x) => [x.i, x]));
  if (!take.words?.length) return <p className="small">{take.transcript}</p>;
  return (
    <p className={s.transcript}>
      {take.words.map((w, i) => {
        const h = hits.get(i);
        return (
          <span key={i} className={h ? (h.doubtful ? s.wDoubt : s.wFill) : undefined}>
            {w.w}{' '}
          </span>
        );
      })}
    </p>
  );
}

function plural(n: number, one: string, few: string, many: string) {
  const a = n % 10,
    b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
}
