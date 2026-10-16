import { describe, expect, it } from 'vitest';
import {
  activityToRow,
  rowToAchievement,
  rowToActivity,
  rowToCoachPlan,
  rowToProblemEvent,
  rowToProfile,
  rowToSession,
  rowToTakeSummary,
  sessionFieldsToRow,
  toISODate,
} from '../../src/server/repo/mappers';
import { MAX_OPS, readOpId, syncBodySchema, syncOpSchema } from '../../src/server/repo/sync-schema';

const ID = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';
const op = (o: object) => syncOpSchema.safeParse({ op_id: 'o1', ...o });

describe('мапперы', () => {
  it('toISODate обрезает до даты', () => {
    expect(toISODate('2026-10-16')).toBe('2026-10-16');
    expect(toISODate('2026-10-16T05:00:00+00:00')).toBe('2026-10-16');
  });

  it('rowToProfile: дефолты и null', () => {
    const p = rowToProfile({ user_id: 'u', timezone: null, daily_goal_min: null, default_mode: 'xx', theme: null, self_problems: null, onboarded: null });
    expect(p).toEqual({ user_id: 'u', timezone: 'Asia/Yekaterinburg', daily_goal_min: 15, default_mode: 'full', theme: 'system', self_problems: [], onboarded: false });
  });

  it('rowToSession: null-ы, числа, массивы', () => {
    const s = rowToSession({ date: '2026-10-16', mode: 'exp', steps_done: [0, 2], breath: 3, clarity: 4, challenge_done: null, full: true, saved_hour: 7, content_version: 2 });
    expect(s).toMatchObject({ date: '2026-10-16', mode: 'exp', steps_done: [0, 2], breath: 3, clarity: 4, challenge_done: null, full: true, saved_hour: 7, content_version: 2, topic_id: null, fillers: null, saved_at: null });
    const empty = rowToSession({ date: '2026-01-01', steps_done: null });
    expect(empty.steps_done).toEqual([]);
    expect(empty.mode).toBe('full');
    expect(empty.content_version).toBe(1);
    expect(empty.full).toBe(false);
  });

  it('rowToActivity', () => {
    const a = rowToActivity({ id: ID, date: '2026-10-16', kind: 'drill', ref: null, duration_s: 90, meta: null, created_at: '2026-10-16T05:00:00Z' });
    expect(a).toEqual({ id: ID, date: '2026-10-16', kind: 'drill', ref: '', duration_s: 90, meta: {}, created_at: '2026-10-16T05:00:00Z' });
  });

  it('activityToRow добавляет user_id и округляет duration', () => {
    const row = activityToRow({ id: ID, date: '2026-10-16', kind: 'take', ref: 't1', duration_s: 12.6, meta: { fpm: 2 }, created_at: '2026-10-16T05:00:00Z' }, 'u1');
    expect(row).toMatchObject({ user_id: 'u1', duration_s: 13, meta: { fpm: 2 } });
  });

  it('rowToTakeSummary: numeric как строка, отсутствие words', () => {
    const t = rowToTakeSummary({ id: ID, session_date: '2026-10-16', take_no: 2, context: 'drill', duration_s: '61.5', status: 'done', fillers_excluded: [1, 2], metrics: { wpm: 130 }, feedback: null, created_at: 'x', analyzed_at: null, source: 'upload' });
    expect(t.duration_s).toBe(61.5);
    expect(t.source).toBe('upload');
    expect(t.fillers_excluded).toEqual([1, 2]);
    expect('words' in t).toBe(false);
    expect('transcript' in t).toBe(false);
  });

  it('rowToProblemEvent / rowToAchievement / rowToCoachPlan', () => {
    expect(rowToProblemEvent({ code: 'fillers', severity: 0.5, evidence: null, created_at: 'c', take_id: null })).toEqual({ code: 'fillers', severity: 0.5, evidence: {}, created_at: 'c', take_id: null });
    expect(rowToAchievement({ code: 'micro', unlocked_at: 'u', source: 'legacy' })).toEqual({ code: 'micro', unlocked_at: 'u', source: 'legacy' });
    expect(rowToAchievement({ code: 'micro', unlocked_at: 'u', source: 'zzz' }).source).toBe('calc');
    expect(rowToCoachPlan({ id: ID, created_at: 'c', source: 'ai', items: null, done: ['a'] })).toEqual({ id: ID, created_at: 'c', source: 'ai', items: [], done: ['a'] });
  });

  it('sessionFieldsToRow отбрасывает undefined, сохраняет null', () => {
    expect(sessionFieldsToRow({ fillers: null, note: undefined, full: true })).toEqual({ fillers: null, full: true });
  });
});

describe('sync-схема', () => {
  it('profile.patch: допустимое и граничные значения', () => {
    expect(op({ op: 'profile.patch', fields: { daily_goal_min: 5, theme: 'dark', self_problems: ['fillers', 'vague'], onboarded: true } }).success).toBe(true);
    expect(op({ op: 'profile.patch', fields: { daily_goal_min: 4 } }).success).toBe(false);
    expect(op({ op: 'profile.patch', fields: { daily_goal_min: 241 } }).success).toBe(false);
    expect(op({ op: 'profile.patch', fields: { daily_goal_min: 10.5 } }).success).toBe(false);
    expect(op({ op: 'profile.patch', fields: { theme: 'blue' } }).success).toBe(false);
    expect(op({ op: 'profile.patch', fields: { default_mode: 'half' } }).success).toBe(false);
    expect(op({ op: 'profile.patch', fields: { self_problems: ['nope'] } }).success).toBe(false);
  });

  it('profile.patch отбрасывает user_id', () => {
    const r = op({ op: 'profile.patch', fields: { user_id: 'evil', onboarded: true } });
    expect(r.success && r.data.op === 'profile.patch' && 'user_id' in r.data.fields).toBe(false);
  });

  it('session.patch: даты, steps_done, clarity', () => {
    const ok = (fields: object, date = '2026-10-16') => op({ op: 'session.patch', date, fields }).success;
    expect(ok({ steps_done: [0, 1, 4], clarity: null, mode: 'exp' })).toBe(true);
    expect(ok({ steps_done: [] })).toBe(true);
    expect(ok({ steps_done: [0, 0] })).toBe(false);
    expect(ok({ steps_done: [5] })).toBe(false);
    expect(ok({ steps_done: [-1] })).toBe(false);
    expect(ok({ clarity: 0 })).toBe(false);
    expect(ok({ clarity: 6 })).toBe(false);
    expect(ok({ clarity: 5 })).toBe(true);
    expect(ok({ saved_at: '2026-10-16T08:30:00.000Z', saved_hour: 8 })).toBe(true);
    expect(ok({ saved_at: 'вчера' })).toBe(false);
    expect(ok({ saved_hour: 24 })).toBe(false);
    expect(ok({}, '2026-02-30')).toBe(false);
    expect(ok({}, '16.10.2026')).toBe(false);
  });

  it('activity.upsert / delete / unlock / plan.done', () => {
    const activity = { id: ID, date: '2026-10-16', kind: 'ritual_step', ref: '2', duration_s: 120, meta: { plan: true }, created_at: '2026-10-16T05:00:00Z' };
    expect(op({ op: 'activity.upsert', activity }).success).toBe(true);
    expect(op({ op: 'activity.upsert', activity: { ...activity, kind: 'bad' } }).success).toBe(false);
    expect(op({ op: 'activity.upsert', activity: { ...activity, id: 'abc' } }).success).toBe(false);
    expect(op({ op: 'activity.upsert', activity: { ...activity, duration_s: -1 } }).success).toBe(false);
    expect(op({ op: 'activity.delete', id: ID }).success).toBe(true);
    expect(op({ op: 'activity.delete', id: 'x' }).success).toBe(false);
    expect(op({ op: 'achievement.unlock', code: 'micro', unlocked_at: '2026-10-16T05:00:00Z' }).success).toBe(true);
    expect(op({ op: 'achievement.unlock', code: '', unlocked_at: '2026-10-16T05:00:00Z' }).success).toBe(false);
    expect(op({ op: 'plan.done', plan_id: ID, item_id: 'p1' }).success).toBe(true);
    expect(op({ op: 'plan.done', plan_id: ID }).success).toBe(false);
    expect(op({ op: 'unknown.op' }).success).toBe(false);
  });

  it('тело: не больше 200 операций, op_id для сообщений', () => {
    expect(syncBodySchema.safeParse({ ops: Array(MAX_OPS).fill({}) }).success).toBe(true);
    expect(syncBodySchema.safeParse({ ops: Array(MAX_OPS + 1).fill({}) }).success).toBe(false);
    expect(syncBodySchema.safeParse({}).success).toBe(false);
    expect(readOpId({ op_id: 'abc' }, 3)).toBe('abc');
    expect(readOpId(null, 3)).toBe('#3');
  });
});
