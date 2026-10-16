import { describe, expect, it } from 'vitest';
import { PROBLEMS, problemInfo } from '../../src/domain/problems/catalog';
import { aiSeverity, buildProfile, metricEvents } from '../../src/domain/problems/events';
import { computeMetrics } from '../../src/domain/speech/metrics';
import type { ProblemCode, ProblemEvent, SpeechMetrics } from '../../src/domain/types';

const NOW = new Date('2026-10-16T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 864e5).toISOString();
const ev = (code: ProblemCode, severity: number, ago: number, extra: Partial<ProblemEvent> = {}): ProblemEvent => ({
  code,
  severity,
  evidence: {},
  created_at: daysAgo(ago),
  ...extra,
});
const base: SpeechMetrics = {
  duration_s: 60, speech_s: 60, word_count: 135, wpm: 135, fillers: [], fillers_count: 0, fpm: 0,
  pauses: [], pauses_per_min: 4, repetitions: [],
};

describe('catalog', () => {
  it('12 проблем, у всех тексты', () => {
    expect(PROBLEMS).toHaveLength(12);
    expect(new Set(PROBLEMS.map((p) => p.code)).size).toBe(12);
    for (const p of PROBLEMS) expect(p.title && p.short && p.tip).toBeTruthy();
    expect(problemInfo('fillers')?.source).toBe('code');
    expect(problemInfo('run_on')?.source).toBe('ai');
  });
});

describe('metricEvents', () => {
  it('чистая речь — нет событий', () => {
    expect(metricEvents(base, 'now')).toEqual([]);
  });
  it('паразиты: severity = fpm/6, только fpm > 0.5', () => {
    const m = computeMetrics(
      [
        { w: 'ну', start: 0, end: 0.3 },
        { w: 'типа', start: 0.5, end: 0.9 },
        ...Array.from({ length: 28 }, (_, i) => ({ w: `слово${i}`, start: 1 + i, end: 1.5 + i })),
      ],
      30,
    );
    const [e] = metricEvents(m, '2026-10-16T00:00:00Z');
    expect(e.code).toBe('fillers');
    expect(e.severity).toBeCloseTo(Math.min(1, m.fpm / 6), 2);
    expect(e.evidence.words).toEqual(['ну', 'типа']);
    expect(e.evidence.value).toBe(m.fpm);
    expect(e.created_at).toBe('2026-10-16T00:00:00Z');
    expect(metricEvents({ ...base, fpm: 0.5 }, 'x')).toEqual([]);
    expect(metricEvents({ ...base, fpm: 12 }, 'x')[0].severity).toBe(1);
  });
  it('темп по порогам', () => {
    expect(metricEvents({ ...base, wpm: 165 }, 'x')).toEqual([]);
    expect(metricEvents({ ...base, wpm: 105 }, 'x')).toEqual([]);
    const fast = metricEvents({ ...base, wpm: 200 }, 'x')[0];
    expect([fast.code, fast.severity]).toEqual(['pace_fast', 1]);
    expect(metricEvents({ ...base, wpm: 182 }, 'x')[0].severity).toBeCloseTo(0.49, 2);
    const slow = metricEvents({ ...base, wpm: 80 }, 'x')[0];
    expect([slow.code, slow.severity]).toEqual(['pace_slow', 1]);
  });
  it('мало пауз: pauses_per_min < 2 и речь ≥ 30с', () => {
    expect(metricEvents({ ...base, pauses_per_min: 1 }, 'x')[0]).toMatchObject({ code: 'few_pauses', severity: 0.5 });
    expect(metricEvents({ ...base, pauses_per_min: 2 }, 'x')).toEqual([]);
    expect(metricEvents({ ...base, pauses_per_min: 0, speech_s: 20 }, 'x')).toEqual([]);
  });
  it('повторы', () => {
    const [e] = metricEvents({ ...base, repetitions: [{ word: 'проект', count: 3, t: 4 }] }, 'x');
    expect(e.code).toBe('repetitions');
    expect(e.evidence.words).toEqual(['проект']);
  });
  it('aiSeverity', () => {
    expect([1, 2, 3].map((s) => aiSeverity(s as 1 | 2 | 3))).toEqual([0.35, 0.65, 0.95]);
  });
});

describe('buildProfile', () => {
  const score = (p: ReturnType<typeof buildProfile>, c: ProblemCode) => p.scores.find((s) => s.code === c)!;

  it('пустой профиль: 12 кодов, нули', () => {
    const p = buildProfile([], [], NOW);
    expect(p.scores).toHaveLength(12);
    expect(p.scores.every((s) => s.score === 0 && s.trend === 0 && s.count === 0 && s.lastSeen === null)).toBe(true);
    expect(p.topFillers).toEqual([]);
    expect(p.takesAnalyzed).toBe(0);
  });
  it('полураспад 10 дней', () => {
    const p = buildProfile([ev('fillers', 1, 0), ev('fillers', 0, 10)], [], NOW);
    expect(score(p, 'fillers').score).toBe(67); // (1·1 + 0.5·0) / 1.5
    const q = buildProfile([ev('fillers', 0.8, 10)], [], NOW);
    expect(score(q, 'fillers').score).toBe(80); // один старый, вес сокращается
  });
  it('окно 60 дней', () => {
    const p = buildProfile([ev('fillers', 1, 61), ev('vague', 0.5, 59)], [], NOW);
    expect(score(p, 'fillers')).toMatchObject({ score: 0, count: 0 });
    expect(score(p, 'fillers').lastSeen).not.toBeNull();
    expect(score(p, 'vague')).toMatchObject({ score: 50, count: 1 });
  });
  it('тренд: 7 дней минус предыдущие 21', () => {
    const p = buildProfile([ev('fillers', 0.2, 2), ev('fillers', 0.8, 15), ev('fillers', 0.8, 20)], [], NOW);
    expect(score(p, 'fillers').trend).toBe(-60);
    const worse = buildProfile([ev('run_on', 0.9, 1), ev('run_on', 0.3, 12)], [], NOW);
    expect(score(worse, 'run_on').trend).toBe(60);
    const noPrev = buildProfile([ev('run_on', 0.9, 1)], [], NOW);
    expect(score(noPrev, 'run_on').trend).toBe(0);
  });
  it('самооценка: старт 40 с весом двух событий', () => {
    expect(score(buildProfile([], ['vague'], NOW), 'vague').score).toBe(40);
    // (2·0.4 + 1·1) / 3 = 0.6
    expect(score(buildProfile([ev('vague', 1, 0)], ['vague'], NOW), 'vague').score).toBe(60);
    // данные перевешивают
    const many = Array.from({ length: 10 }, () => ev('vague', 0, 0));
    expect(score(buildProfile(many, ['vague'], NOW), 'vague').score).toBe(Math.round((0.8 / 12) * 100));
  });
  it('сортировка по score и lastSeen', () => {
    const p = buildProfile([ev('weak_ending', 0.4, 3), ev('detours', 0.9, 5), ev('detours', 0.9, 1)], [], NOW);
    expect(p.scores.slice(0, 2).map((s) => s.code)).toEqual(['detours', 'weak_ending']);
    expect(score(p, 'detours').lastSeen).toBe(daysAgo(1));
    expect(score(p, 'detours').count).toBe(2);
  });
  it('любимые паразиты и число разобранных дублей', () => {
    const events = [
      ev('fillers', 0.5, 1, { evidence: { words: ['типа', 'типа', 'ну'] }, take_id: 'a' }),
      ev('fillers', 0.5, 3, { evidence: { words: ['типа', 'э'] }, take_id: 'b' }),
      ev('pace_fast', 0.5, 3, { take_id: 'b' }),
      ev('fillers', 0.5, 90, { evidence: { words: ['вот', 'вот', 'вот', 'вот'] }, take_id: 'c' }),
    ];
    const p = buildProfile(events, [], NOW);
    expect(p.topFillers).toEqual([
      { word: 'типа', count: 3 },
      { word: 'ну', count: 1 },
      { word: 'э', count: 1 },
    ]);
    expect(p.takesAnalyzed).toBe(3);
  });
});
