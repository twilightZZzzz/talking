'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Take } from '@/domain/types';
import { useApp } from '@/client/store';
import { TakeReview } from '@/components/exercise/TakeReview';
import { Mascot } from '@/components/ui/Mascot';
import { Icon } from '@/components/ui/Icon';
import s from '@/components/exercise/exercise.module.css';

export default function TakePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { upsertTake } = useApp();
  const [take, setTake] = useState<Take | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/takes/${id}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? 'Не найдено');
        setTake((j.take ?? j) as Take);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'));
  }, [id]);

  async function exclude(i: number) {
    if (!take) return;
    const next = [...take.fillers_excluded, i];
    setTake({ ...take, fillers_excluded: next });
    const r = await fetch(`/api/takes/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fillers_excluded: next }) });
    if (r.ok) {
      const j = await r.json();
      const t = (j.take ?? j) as Take;
      setTake(t);
      const { words: _w, transcript: _t, ...summary } = t;
      void _w;
      void _t;
      upsertTake(summary);
    }
  }

  return (
    <main className={s.page}>
      <div className={s.head}>
        <button className="btn btn-icon" aria-label="Назад" onClick={() => router.back()}>
          <Icon name="back" />
        </button>
        <div>
          <span className="label">{take ? new Date(take.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : ''}</span>
        </div>
      </div>
      {error && (
        <div className="card" style={{ alignItems: 'center' }}>
          <Mascot mood="sad" size={70} />
          <p>{error}</p>
        </div>
      )}
      {!take && !error && <Mascot mood="think" size={80} bob />}
      {take && (
        <>
          <h1>{take.topic ?? 'Дубль'}</h1>
          {take.status !== 'done' ? (
            <div className="card">
              <p>Дубль ещё не разобран ({take.error ?? take.status}).</p>
            </div>
          ) : (
            <TakeReview
              take={take}
              onExclude={(i) => void exclude(i)}
            />
          )}
        </>
      )}
    </main>
  );
}
