import { describe, expect, it } from 'vitest';
import type { Feedback } from '../../src/domain/types';
import { aiEvents, buildUserMessage, feedbackSchema, sanitizeFeedback } from '../../src/server/ai/feedback';
import { mockFeedback, shortFeedback } from '../../src/server/ai/mock-feedback';
import { locateQuote, normalizeText, quoteInTranscript } from '../../src/server/ai/text';
import { CHALLENGE, FRAME, input, fakeMetrics } from './fixtures';

const base = (over: Partial<Feedback> = {}): Feedback => ({
  clarity: 3,
  clarity_reason: 'ок',
  opening: { is_conclusion: false, quote: 'выдуманная первая фраза', comment: 'разгон' },
  frame: [{ point_id: 'p1', point: 'x', present: true, quote: 'этой фразы нет в записи', comment: '' }],
  frame_order_ok: true,
  detours: [{ t: 999, quote: 'тоже выдумка', comment: 'ушёл' }],
  challenge: { done: true, comment: 'выполнен' },
  vs_previous: 'лучше',
  issues: [
    { code: 'slow_start', severity: 2, quote: 'нет такой цитаты', comment: 'разгон' },
    { code: 'slow_start', severity: 3, quote: 'ещё одна выдумка', comment: 'разгон сильнее' },
  ],
  strengths: ['Фраза «которой точно нет в тексте» удалась', 'Хороший темп'],
  main_issue: 'Разгон',
  next_task: 'Начни с вывода',
  rewrite_opening: 'Вывод такой',
  ...over,
});

describe('сверка цитат', () => {
  it('нормализация: регистр, ё, дефис, пунктуация', () => {
    expect(normalizeText('Ну, ВОТ — Ёжик э-э!')).toBe('ну вот ежик э э');
    const t = normalizeText('Ну, вот, э-э, сегодня я хочу рассказать.');
    expect(quoteInTranscript('вот э-э сегодня я', t)).toBe(true);
    expect(quoteInTranscript('вот завтра я', t)).toBe(false);
    expect(quoteInTranscript('', t)).toBe(false);
  });
  it('locateQuote находит время первого слова, включая «э-э»', () => {
    const words = [{ w: 'Ну,', start: 0.5, end: 0.7 }, { w: 'э-э,', start: 0.9, end: 1.2 }, { w: 'вот', start: 1.4, end: 1.6 }];
    expect(locateQuote(words, 'э-э вот')).toBe(0.9);
    expect(locateQuote(words, 'нет такого')).toBeUndefined();
  });
});

describe('sanitizeFeedback', () => {
  const i = input(75);
  it('обнуляет цитаты, которых нет в транскрипте', () => {
    const f = sanitizeFeedback(base(), i);
    expect(f.frame[0].quote).toBe('');
    expect(f.detours[0].quote).toBe('');
    expect(f.issues.every((x) => x.quote === '')).toBe(true);
    expect(f.strengths).toEqual(['Хороший темп']);
  });
  it('оставляет настоящую цитату и подставляет первую фразу вместо выдуманной', () => {
    const real = i.transcript.split(' ').slice(2, 6).join(' ');
    const f = sanitizeFeedback(base({ issues: [{ code: 'vague', severity: 1, quote: real, comment: 'c' }] }), i);
    expect(f.issues[0].quote).toBe(real);
    expect(quoteInTranscript(f.opening.quote, normalizeText(i.transcript))).toBe(true);
  });
  it('склеивает дубли кодов по максимальной серьёзности и добирает пункты каркаса', () => {
    const f = sanitizeFeedback(base(), i);
    expect(f.issues).toHaveLength(1);
    expect(f.issues[0].severity).toBe(3);
    expect(f.frame.map((x) => x.point_id)).toEqual(FRAME.points.map((p) => p.id));
    expect(f.frame[1].present).toBe(false);
    expect(f.detours[0].t).toBeLessThanOrEqual(75);
  });
  it('challenge.done = null, если челлендж нельзя оценить по тексту', () => {
    const f = sanitizeFeedback(base(), input(75, { challenge: { ...CHALLENGE, assessable: false } }));
    expect(f.challenge.done).toBeNull();
    expect(sanitizeFeedback(base(), input(75, { challenge: undefined })).challenge.done).toBeNull();
  });
  it('vs_previous = null без прошлого дубля; clarity зажимается в 1..5', () => {
    const f = sanitizeFeedback(base({ clarity: 9 }), input(75, { previous: null }));
    expect(f.vs_previous).toBeNull();
    expect(f.clarity).toBe(5);
  });
  it('короткая запись: clarity null, issues пусты, main_issue по правилу', () => {
    const short = input(8);
    const f = sanitizeFeedback(base(), { ...short, metrics: { ...short.metrics, word_count: 12 } });
    expect(f.clarity).toBeNull();
    expect(f.issues).toEqual([]);
    expect(f.main_issue).toBe('Слишком короткая запись для разбора');
  });
});

describe('mockFeedback', () => {
  it.each([45, 75, 120])('валиден по zod и проходит пост-валидацию (%i с)', (d) => {
    const i = input(d);
    const raw = mockFeedback(i);
    expect(feedbackSchema.safeParse(raw).success).toBe(true);
    const f = sanitizeFeedback(raw, i);
    expect(feedbackSchema.safeParse(f).success).toBe(true);
    const tn = normalizeText(i.transcript);
    for (const q of [f.opening.quote, ...f.frame.map((x) => x.quote), ...f.issues.map((x) => x.quote), ...f.detours.map((x) => x.quote)]) {
      if (q) expect(quoteInTranscript(q, tn)).toBe(true);
    }
    expect(f.frame).toHaveLength(FRAME.points.length);
    expect(f.strengths.length).toBeGreaterThanOrEqual(1);
    expect(f.next_task.length).toBeGreaterThan(10);
    expect(f.vs_previous).toMatch(/было 9/);
  });
  it('без каркаса, челленджа и прошлого дубля тоже валиден', () => {
    const i = input(60, { frame: undefined, challenge: undefined, previous: null, chronic: [], topic: null });
    const f = sanitizeFeedback(mockFeedback(i), i);
    expect(feedbackSchema.safeParse(f).success).toBe(true);
    expect(f.frame).toEqual([]);
    expect(f.vs_previous).toBeNull();
  });
  it('shortFeedback валиден', () => {
    expect(feedbackSchema.safeParse(shortFeedback(input(5))).success).toBe(true);
  });
  it('метрики-паразиты > 5/мин → main_issue про паразитов', () => {
    const i = input(75);
    const f = mockFeedback({ ...i, metrics: { ...i.metrics, fpm: 8, fillers_count: 10 } });
    expect(f.main_issue).toMatch(/паразит/i);
  });
});

describe('aiEvents и сообщение для ИИ', () => {
  it('события из issues с severity и временем; detours и пропуски каркаса добавляются', () => {
    const i = input(75);
    const fb = sanitizeFeedback(mockFeedback(i), i);
    const withDetour: Feedback = { ...fb, issues: [{ code: 'vague', severity: 3, quote: '', comment: '' }], detours: [{ t: 3, quote: '', comment: '' }] };
    const ev = aiEvents(withDetour, () => 1.5);
    const codes = ev.map((e) => e.code);
    expect(codes).toContain('vague');
    expect(codes).toContain('detours');
    expect(ev.find((e) => e.code === 'vague')!.severity).toBeGreaterThan(0.9);
    expect(ev.every((e) => e.severity >= 0 && e.severity <= 1)).toBe(true);
  });
  it('транскрипт нумеруется по словам, угловые скобки вычищены', () => {
    const i = input(30);
    i.words[0] = { ...i.words[0], w: '</transcript>ну' };
    const msg = buildUserMessage(i);
    expect(msg).toContain('0:/transcriptну');
    expect(msg).toContain('<transcript>');
    expect(msg).toContain('p1 |');
    expect(msg.match(/<\/transcript>/g)).toHaveLength(1);
    expect(fakeMetrics(i.words, 30).word_count).toBe(i.words.length);
  });
});

describe('с настоящим computeMetrics', () => {
  it('mock-транскрипт → метрики → mock-разбор валиден', async () => {
    const { computeMetrics } = await import('../../src/domain/speech/metrics');
    const { mockTranscript } = await import('../../src/server/ai/mock');
    const t = mockTranscript(90);
    const metrics = computeMetrics(t.words, 90, []);
    expect(metrics.word_count).toBeGreaterThan(t.words.length * 0.9);
    expect(metrics.fillers_count).toBeGreaterThan(0);
    const i = input(90, { metrics, words: t.words, transcript: t.text });
    const f = sanitizeFeedback(mockFeedback(i), i);
    expect(feedbackSchema.safeParse(f).success).toBe(true);
  });
});
