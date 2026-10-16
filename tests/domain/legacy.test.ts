import { describe, expect, it } from 'vitest';
import { computeStats } from '../../src/domain/gamification/calc';
import { parseLegacyExport, stableUuid } from '../../src/domain/legacy';

const enc = (o: unknown) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
// как btoa(unescape(encodeURIComponent(json))) в браузере
const browserEnc = (o: unknown) => btoa(unescape(encodeURIComponent(JSON.stringify(o))));

const sample = {
  log: {
    '2026-10-01': { f: 7, r: 3, n: 'ушёл в сторону — «история»', ch: true, full: true, t: 8 },
    '2026-10-02': { f: 3, r: 0, n: '', ch: false, full: false },
  },
  done: { '2026-10-01': [0, 1, 2, 3, 4], '2026-10-02': [3, 2], '2026-09-30': [0] },
  ach: { first: '2026-10-01', s3: '2026-10-03', bogus: '2026-10-01' },
  breath: { '2026-10-01': 25, '2026-10-03': 0 },
  mode: 'exp',
};

describe('parseLegacyExport', () => {
  it('сессии по объединению дат log/done/breath', () => {
    const r = parseLegacyExport(enc(sample));
    expect(r.sessions.map((s) => s.date)).toEqual(['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03']);
    expect(r.defaultMode).toBe('exp');
    const [s0, s1, s2, s3] = r.sessions;
    expect(s0).toMatchObject({ steps_done: [0], fillers: null, saved_at: null, full: false, topic_id: null, breath: null, mode: 'exp' });
    expect(s1).toMatchObject({ steps_done: [0, 1, 2, 3, 4], fillers: 7, clarity: 3, challenge_done: true, full: true, saved_hour: 8, breath: 25 });
    expect(s1.note).toBe('ушёл в сторону — «история»');
    expect(s1.saved_at).toBeTruthy();
    expect(s2).toMatchObject({ steps_done: [2, 3], fillers: 3, clarity: null, challenge_done: false, note: null, saved_hour: null });
    expect(s2.saved_at).toBeTruthy();
    expect(s3).toMatchObject({ steps_done: [], breath: null, saved_at: null });
  });
  it('шаги → ritual_step с детерминированными uuid', () => {
    const a = parseLegacyExport(enc(sample)).activities;
    const b = parseLegacyExport(enc(sample)).activities;
    expect(a).toHaveLength(1 + 5 + 2);
    expect(a.every((x) => x.kind === 'ritual_step' && x.meta.legacy === true)).toBe(true);
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
    expect(new Set(a.map((x) => x.id)).size).toBe(a.length);
    for (const x of a) expect(x.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a.find((x) => x.date === '2026-10-01' && x.ref === '2')!.duration_s).toBe(300);
  });
  it('достижения: только известные коды', () => {
    const r = parseLegacyExport(enc(sample));
    expect(r.achievements).toEqual([
      { code: 'first', unlocked_at: '2026-10-01T12:00:00.000Z', source: 'legacy' },
      { code: 's3', unlocked_at: '2026-10-03T12:00:00.000Z', source: 'legacy' },
    ]);
  });
  it('base64 как в браузере (UTF-8 через escape), пробелы по краям', () => {
    const r = parseLegacyExport('  ' + browserEnc(sample) + '\n');
    expect(r.sessions[1].note).toBe('ушёл в сторону — «история»');
  });
  it('минимальный экспорт и XP', () => {
    const r = parseLegacyExport(enc({ log: { '2026-10-01': { f: 2, r: 4, ch: true, full: false } } }));
    expect(r.defaultMode).toBe('full');
    expect(r.sessions).toHaveLength(1);
    const s = computeStats({ sessions: r.sessions, activities: r.activities, takes: [], today: '2026-10-01', dailyGoalMin: 999 });
    expect(s.xp).toBe(45);
  });
  it('мусор — понятные ошибки', () => {
    expect(() => parseLegacyExport('не base64!!')).toThrow(/не читается/);
    expect(() => parseLegacyExport(enc({ done: {} }))).toThrow(/старой версии/);
    expect(() => parseLegacyExport(enc({ log: { вчера: { f: 1 } } }))).toThrow();
    expect(() => parseLegacyExport(enc({ log: { '2026-10-01': { f: -1 } } }))).toThrow();
    expect(() => parseLegacyExport(enc({ log: {}, done: { '2026-10-01': [9] } }))).toThrow();
  });
  it('stableUuid стабилен и различает входы', () => {
    expect(stableUuid('a')).toBe(stableUuid('a'));
    expect(stableUuid('a')).not.toBe(stableUuid('b'));
  });
});
