import { PROBLEMS } from './catalog';
import type { ProblemCode, ProblemEvent, ProblemProfile, ProblemScore, SpeechMetrics } from '../types';

const DAY_MS = 864e5;
const WINDOW_DAYS = 60;
const HALF_LIFE_DAYS = 10;
const SELF_SCORE = 40;
const SELF_WEIGHT = 2;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const r2 = (x: number) => Math.round(x * 100) / 100;

/** События проблем, которые считаются кодом из метрик (fillers, pace_*, few_pauses, repetitions). created_at = now ISO. */
export function metricEvents(m: SpeechMetrics, now: string): Omit<ProblemEvent, 'take_id'>[] {
  const out: Omit<ProblemEvent, 'take_id'>[] = [];
  const add = (code: ProblemCode, severity: number, evidence: ProblemEvent['evidence']) =>
    out.push({ code, severity: r2(clamp01(severity)), evidence, created_at: now });

  if (m.fpm > 0.5) {
    const hits = m.fillers.filter((f) => !f.doubtful);
    add('fillers', m.fpm / 6, { words: hits.map((f) => f.word), value: m.fpm, t: hits[0]?.t });
  }
  if (m.speech_s >= 10 && m.word_count >= 10) {
    if (m.wpm > 165) add('pace_fast', (m.wpm - 165) / 35, { value: m.wpm });
    else if (m.wpm < 105) add('pace_slow', (105 - m.wpm) / 25, { value: m.wpm });
  }
  if (m.speech_s >= 30 && m.pauses_per_min < 2) {
    add('few_pauses', Math.max(0.2, (2 - m.pauses_per_min) / 2), { value: m.pauses_per_min });
  }
  if (m.repetitions.length) {
    add('repetitions', 0.3 + 0.2 * m.repetitions.length, {
      words: m.repetitions.map((r) => r.word),
      value: m.repetitions.length,
      t: m.repetitions[0].t,
    });
  }
  return out;
}

/** severity 1|2|3 из ответа ИИ → 0..1 */
export function aiSeverity(s: 1 | 2 | 3): number {
  return s === 1 ? 0.35 : s === 2 ? 0.65 : 0.95;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Профиль проблем по событиям (см. SPEC §3).
 *  score = взвешенное среднее severity за 60 дней (полураспад 10 дней) × 100.
 *  Самооценка — один «фиктивный» балл 40 с весом 2. trend = среднее за 7 дней − среднее за предыдущие 21 (×100). */
export function buildProfile(events: ProblemEvent[], selfProblems: ProblemCode[], now: Date): ProblemProfile {
  const t0 = now.getTime();
  const rows = events
    .map((e) => ({ e, age: (t0 - new Date(e.created_at).getTime()) / DAY_MS }))
    .filter((r) => Number.isFinite(r.age));

  const scores: ProblemScore[] = PROBLEMS.map(({ code }) => {
    const mine = rows.filter((r) => r.e.code === code);
    const win = mine.filter((r) => r.age <= WINDOW_DAYS);
    let num = 0;
    let den = 0;
    for (const r of win) {
      const w = Math.pow(0.5, Math.max(0, r.age) / HALF_LIFE_DAYS);
      num += w * r.e.severity;
      den += w;
    }
    if (selfProblems.includes(code)) {
      num += SELF_WEIGHT * (SELF_SCORE / 100);
      den += SELF_WEIGHT;
    }
    const score = den > 0 ? Math.round((num / den) * 100) : 0;

    const recent = avg(mine.filter((r) => r.age <= 7).map((r) => r.e.severity));
    const before = avg(mine.filter((r) => r.age > 7 && r.age <= 28).map((r) => r.e.severity));
    const trend = recent !== null && before !== null ? Math.round((recent - before) * 100) : 0;

    const lastSeen = mine.length
      ? mine.reduce((a, b) => (new Date(a.e.created_at) > new Date(b.e.created_at) ? a : b)).e.created_at
      : null;
    return { code, score, trend, count: win.length, lastSeen };
  }).sort((a, b) => b.score - a.score);

  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.e.code !== 'fillers' || r.age > WINDOW_DAYS) continue;
    for (const w of r.e.evidence.words ?? []) counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  const topFillers = [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, 10);

  const takes = new Set(events.map((e) => e.take_id).filter((x): x is string => !!x));
  return { scores, topFillers, takesAnalyzed: takes.size };
}
