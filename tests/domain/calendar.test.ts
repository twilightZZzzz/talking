import { describe, expect, it } from 'vitest';
import { addDays, dailyContent, dayNumber, trainingDate, weekStart } from '../../src/domain/calendar';
import { CHALLENGES, FRAMES, TOPICS, TWISTERS } from '../../src/domain/content';
import type { ProblemScore } from '../../src/domain/types';

const EKB = 'Asia/Yekaterinburg';

describe('trainingDate', () => {
  it('Екатеринбург около полуночи (UTC+5)', () => {
    expect(trainingDate(new Date('2026-10-15T18:59:59Z'), EKB)).toBe('2026-10-15');
    expect(trainingDate(new Date('2026-10-15T19:00:00Z'), EKB)).toBe('2026-10-16');
    expect(trainingDate(new Date('2026-10-15T19:00:01Z'), EKB)).toBe('2026-10-16');
  });
  it('другая зона и смена года', () => {
    expect(trainingDate(new Date('2026-12-31T20:00:00Z'), EKB)).toBe('2027-01-01');
    expect(trainingDate(new Date('2026-12-31T20:00:00Z'), 'America/New_York')).toBe('2026-12-31');
  });
});

describe('dayNumber / addDays / weekStart', () => {
  it('последовательные дни и переходы через месяц/год/високосный', () => {
    expect(dayNumber('1970-01-01')).toBe(0);
    expect(dayNumber('2026-10-16') - dayNumber('2026-10-15')).toBe(1);
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('совпадает с legacy dayN: floor(localMidnight/864e5 + .5)', () => {
    for (const [y, m, d] of [[2026, 10, 16], [2026, 1, 1], [2027, 3, 29]]) {
      const local = new Date(y, m - 1, d);
      if (Math.abs(local.getTimezoneOffset()) > 720) continue; // legacy корректен в зонах UTC−12..+12
      const legacy = Math.floor(local.getTime() / 864e5 + 0.5);
      const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      expect(dayNumber(iso)).toBe(legacy);
    }
  });
  it('weekStart — понедельник', () => {
    expect(weekStart('2026-10-16')).toBe('2026-10-12'); // пятница
    expect(weekStart('2026-10-12')).toBe('2026-10-12');
    expect(weekStart('2026-10-18')).toBe('2026-10-12'); // воскресенье
    expect(weekStart('2026-10-19')).toBe('2026-10-19');
  });
});

describe('dailyContent', () => {
  it('формулы legacy: tw=dayN%len, tp=dayN*7%len, frame=dayN%len', () => {
    for (const date of ['2026-10-16', '2026-10-17', '2027-01-01']) {
      const n = dayNumber(date);
      const c = dailyContent(date);
      expect(c.twister_id).toBe(TWISTERS[n % TWISTERS.length].id);
      expect(c.topic_id).toBe(TOPICS[(n * 7) % TOPICS.length].id);
      expect(c.frame_id).toBe(FRAMES[n % FRAMES.length].id);
      expect(c.challenge_id).toBe(CHALLENGES[n % CHALLENGES.length].id);
    }
  });
  it('без профиля и со слабым профилем челлендж одинаков', () => {
    const weak: ProblemScore[] = [{ code: 'fillers', score: 20, trend: 0, count: 1, lastSeen: null }];
    expect(dailyContent('2026-10-16', { profileScores: weak })).toEqual(dailyContent('2026-10-16'));
  });
  it('челлендж под топ-2 проблемы, детерминированно', () => {
    const scores: ProblemScore[] = [
      { code: 'run_on', score: 70, trend: 0, count: 5, lastSeen: null },
      { code: 'weak_ending', score: 45, trend: 0, count: 5, lastSeen: null },
      { code: 'fillers', score: 40, trend: 0, count: 5, lastSeen: null },
    ];
    const allowed = CHALLENGES.filter((c) => c.targets.some((t) => t === 'run_on' || t === 'weak_ending')).map((c) => c.id);
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const d = addDays('2026-10-01', i);
      const c = dailyContent(d, { profileScores: scores });
      expect(allowed).toContain(c.challenge_id);
      expect(dailyContent(d, { profileScores: [...scores].reverse() })).toEqual(c);
      seen.add(c.challenge_id);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});
