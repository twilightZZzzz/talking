// Чистый расчёт XP, серии и календаря из истории (аналог calc() в legacy). Ничего не хранится счётчиком.
import { addDays, weekStart } from '../calendar';
import { getExercise } from '../exercises';
import type { Activity, ISODate, Session, TakeSummary } from '../types';
import { levelFor, type LevelInfo } from './levels';

/** Номинал шагов ритуала, мин */
export const RITUAL_STEP_MINUTES = [3, 2, 5, 3, 2];

export const XP = {
  step: 10,
  drill: 10,
  drillLong: 5,
  take: 15,
  improve: 10,
  daySaved: 20,
  challenge: 25,
  full: 30,
  record: 30,
  goal: 20,
} as const;

export interface StatsInput {
  sessions: Session[];
  activities: Activity[];
  takes: TakeSummary[];
  today: ISODate;
  dailyGoalMin: number;
}

export interface DayStats {
  xp: number;
  multiplier: number;
  minutes: number;
  active: boolean;
  goalMet: boolean;
  record: boolean;
}

export interface Stats {
  xp: number;
  level: LevelInfo;
  perDay: Record<ISODate, DayStats>;
  /** текущая серия: если сегодня не активен — считаем от вчера */
  streak: number;
  maxStreak: number;
  /** множитель, который получит сегодняшний день */
  multiplier: number;
  /** активных дней на этой неделе (пн–вс) */
  weekActive: number;
  bestFillers: number | null;
  records: number;
  fullCount: number;
  challengeCount: number;
  minutesToday: number;
  minutesTotal: number;
  takesAnalyzed: number;
  /** 56 дней до конца текущей недели; 0 пусто, 1 активен, 2 цель выполнена */
  calendar: { date: ISODate; level: 0 | 1 | 2 }[];
}

const round1 = (x: number) => Math.round(x * 10) / 10;

interface DayAcc {
  steps: Set<number>;
  drills: Activity[];
  takes: Activity[];
  other: Activity[];
  saved?: Session;
}

function drillSeconds(a: Activity): number {
  if (a.duration_s > 0) return a.duration_s;
  const base = typeof a.meta.base_exercise_id === 'string' ? a.meta.base_exercise_id : a.ref;
  return (getExercise(base)?.minutes ?? 0) * 60;
}

function collectDays(input: Pick<StatsInput, 'sessions' | 'activities' | 'takes'>): Map<ISODate, DayAcc> {
  const days = new Map<ISODate, DayAcc>();
  const day = (d: ISODate) => {
    let x = days.get(d);
    if (!x) days.set(d, (x = { steps: new Set(), drills: [], takes: [], other: [] }));
    return x;
  };
  for (const s of input.sessions) {
    const d = day(s.date);
    s.steps_done.forEach((i) => d.steps.add(i));
    if (s.saved_at) d.saved = s;
  }
  for (const a of input.activities) {
    const d = day(a.date);
    if (a.kind === 'ritual_step') {
      const i = Number(a.ref);
      if (Number.isInteger(i)) d.steps.add(i);
    } else if (a.kind === 'drill') d.drills.push(a);
    else if (a.kind === 'take') d.takes.push(a);
    else if (a.kind === 'legacy') d.other.push(a);
  }
  for (const t of input.takes) day(t.session_date);
  return days;
}

const byCreated = (a: Activity, b: Activity) =>
  a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : 1;

export function computeStats(input: StatsInput): Stats {
  const { today, dailyGoalMin } = input;
  const days = collectDays(input);
  const dates = [...days.keys()].sort();

  // минуты и активность
  const minutes: Record<ISODate, number> = {};
  const active = new Set<ISODate>();
  for (const date of dates) {
    const d = days.get(date)!;
    let sec = 0;
    d.steps.forEach((i) => (sec += (RITUAL_STEP_MINUTES[i] ?? 0) * 60));
    d.drills.forEach((a) => (sec += drillSeconds(a)));
    d.takes.forEach((a) => (sec += a.duration_s));
    d.other.forEach((a) => (sec += a.duration_s));
    minutes[date] = sec / 60;
    if (d.saved || minutes[date] >= 5 || d.takes.length > 0) active.add(date);
  }

  const streakAt = (date: ISODate) => {
    let n = 0;
    for (let x = date; active.has(x); x = addDays(x, -1)) n++;
    return n;
  };

  // XP по дням
  const perDay: Record<ISODate, DayStats> = {};
  let xp = 0;
  let best: number | null = null;
  let records = 0;
  let fullCount = 0;
  let challengeCount = 0;
  for (const date of dates) {
    const d = days.get(date)!;
    let x = d.steps.size * XP.step;
    for (const a of d.drills) x += XP.drill + (drillSeconds(a) >= 300 ? XP.drillLong : 0);
    const takes = [...d.takes].sort(byCreated);
    x += takes.length * XP.take;
    for (let k = 1; k < takes.length; k++) {
      const p = takes[k - 1].meta.fpm;
      const c = takes[k].meta.fpm;
      if (typeof p === 'number' && typeof c === 'number' && c < p) x += XP.improve;
    }
    let record = false;
    const e = d.saved;
    if (e) {
      x += XP.daySaved;
      if (e.challenge_done) {
        x += XP.challenge;
        challengeCount++;
      }
      if (e.full) {
        x += XP.full;
        fullCount++;
      }
      if (e.fillers !== null) {
        if (best !== null && e.fillers < best) {
          x += XP.record;
          records++;
          record = true;
        }
        if (best === null || e.fillers < best) best = e.fillers;
      }
    }
    const goalMet = minutes[date] >= dailyGoalMin;
    if (goalMet) x += XP.goal;
    const s = active.has(date) ? streakAt(date) : 0;
    const multiplier = Math.min(1.5, 1 + Math.max(0, s - 1) * 0.1);
    const got = Math.round(x * multiplier);
    xp += got;
    perDay[date] = { xp: got, multiplier, minutes: round1(minutes[date]), active: active.has(date), goalMet, record };
  }

  const streak = active.has(today) ? streakAt(today) : streakAt(addDays(today, -1));
  let maxStreak = 0;
  for (const date of active) {
    if (!active.has(addDays(date, -1))) {
      let n = 0;
      for (let x = date; active.has(x); x = addDays(x, 1)) n++;
      maxStreak = Math.max(maxStreak, n);
    }
  }
  const multiplier = Math.min(1.5, 1 + Math.max(0, active.has(today) ? streak - 1 : streak) * 0.1);

  const mon = weekStart(today);
  let weekActive = 0;
  for (let i = 0; i < 7; i++) if (active.has(addDays(mon, i))) weekActive++;

  const end = addDays(mon, 6);
  const calendar: Stats['calendar'] = [];
  for (let i = 55; i >= 0; i--) {
    const date = addDays(end, -i);
    const p = perDay[date];
    calendar.push({ date, level: p?.goalMet ? 2 : p?.active ? 1 : 0 });
  }

  const doneTakes = input.takes.filter((t) => t.status === 'done').length;
  const takeActs = new Set(input.activities.filter((a) => a.kind === 'take').map((a) => a.ref)).size;

  return {
    xp,
    level: levelFor(xp),
    perDay,
    streak,
    maxStreak,
    multiplier,
    weekActive,
    bestFillers: best,
    records,
    fullCount,
    challengeCount,
    minutesToday: round1(minutes[today] ?? 0),
    minutesTotal: round1(Object.values(minutes).reduce((a, b) => a + b, 0)),
    takesAnalyzed: Math.max(doneTakes, takeActs),
    calendar,
  };
}

