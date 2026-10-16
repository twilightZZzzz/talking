// Даты тренировки и контент дня. Всё в локальной дате пользователя (ISODate), без Date в локальной зоне.
import { CHALLENGES, FRAMES, TOPICS, TWISTERS } from '../content';
import type { ISODate, ProblemScore } from '../types';

const DAY_MS = 864e5;

/** Локальная дата в таймзоне tz для момента now */
export function trainingDate(now: Date, tz: string): ISODate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Локальный час (0..23) в таймзоне tz */
export function localHour(now: Date, tz: string): number {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' })
    .formatToParts(now)
    .find((p) => p.type === 'hour')!.value;
  return Number(h) % 24;
}

/** Номер дня от эпохи (1970-01-01 = 0). Совпадает с legacy dayN для любой локальной зоны */
export function dayNumber(date: ISODate): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function fromDayNumber(n: number): ISODate {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(date: ISODate, n: number): ISODate {
  return fromDayNumber(dayNumber(date) + n);
}

/** Понедельник недели, в которую входит date */
export function weekStart(date: ISODate): ISODate {
  return addDays(date, -((dayNumber(date) + 3) % 7));
}

/** Разница в днях b − a */
export function diffDays(a: ISODate, b: ISODate): number {
  return dayNumber(b) - dayNumber(a);
}

export interface DailyContent {
  twister_id: string;
  topic_id: string;
  frame_id: string;
  challenge_id: string;
}

export function dailyContent(date: ISODate, opts: { profileScores?: ProblemScore[] } = {}): DailyContent {
  const n = dayNumber(date);
  let challenge = CHALLENGES[n % CHALLENGES.length];
  const scores = [...(opts.profileScores ?? [])].sort((a, b) => b.score - a.score);
  if (scores.length && scores[0].score >= 30) {
    const top = scores.slice(0, 2).map((s) => s.code);
    const pool = CHALLENGES.filter((c) => c.targets.some((t) => top.includes(t)));
    if (pool.length) challenge = pool[n % pool.length];
  }
  return {
    twister_id: TWISTERS[n % TWISTERS.length].id,
    topic_id: TOPICS[(n * 7) % TOPICS.length].id,
    frame_id: FRAMES[n % FRAMES.length].id,
    challenge_id: challenge.id,
  };
}
