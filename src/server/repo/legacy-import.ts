import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Activity, Mode, Session } from '@/domain/types';
import { activityToRow, sessionFieldsToRow, type Row } from './mappers';
import { fetchAll } from './queries';
import { sessionFieldsSchema } from './sync-schema';

/** Форма результата parseLegacyExport (домен), читаем defensively. */
export interface LegacyParsed {
  sessions: Partial<Session>[];
  activities: Partial<Activity>[];
  achievements: { code: string; unlocked_at?: string }[];
  defaultMode?: Mode | null;
}

export interface ImportSummary {
  dryRun: boolean;
  /** даты, которых ещё не было в базе */
  newDays: number;
  /** даты, которые уже есть (итоги не перезаписываются) */
  existingDays: number;
  /** сколько достижений будет/было добавлено (ещё не открытых) */
  achievements: number;
  /** сколько отметок шагов ритуала во всех импортируемых днях */
  steps: number;
  /** сколько активностей будет/было добавлено */
  activities: number;
  /** существующих дней, дополненных (steps_done / breath) */
  mergedDays: number;
  /** сессий пропущено из-за некорректных данных */
  skipped: number;
  /** default_mode обновлён у профиля */
  defaultModeSet: boolean;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = ['ritual_step', 'drill', 'take', 'day_saved', 'legacy'];
const CHUNK = 500;

const dbErr = (m: string) => new Error(`Ошибка базы данных: ${m}`);
const actKey = (date: string, kind: string, ref: string) => `${date}|${kind}|${ref}`;

export async function runLegacyImport(
  db: SupabaseClient,
  userId: string,
  parsed: LegacyParsed,
  opts: { dryRun: boolean; onboarded: boolean },
): Promise<ImportSummary> {
  // ---- нормализация входа ----
  const sessions = new Map<string, Row>(); // date → поля
  let skipped = 0;
  for (const s of parsed.sessions ?? []) {
    const date = s?.date;
    if (typeof date !== 'string' || !DATE_RE.test(date)) {
      skipped++;
      continue;
    }
    const { date: _d, ...rest } = s as Session;
    const f = sessionFieldsSchema.safeParse(rest);
    if (!f.success) {
      skipped++;
      continue;
    }
    sessions.set(date, sessionFieldsToRow(f.data));
  }

  const activities: Row[] = [];
  const seen = new Set<string>();
  for (const a of parsed.activities ?? []) {
    if (!a || typeof a.date !== 'string' || !DATE_RE.test(a.date) || !KINDS.includes(a.kind as string)) continue;
    const key = actKey(a.date, a.kind!, String(a.ref ?? ''));
    if (seen.has(key)) continue;
    seen.add(key);
    activities.push(
      activityToRow(
        {
          id: a.id && UUID_RE.test(a.id) ? a.id : randomUUID(),
          date: a.date,
          kind: a.kind!,
          ref: String(a.ref ?? ''),
          duration_s: Number(a.duration_s) || 0,
          meta: a.meta ?? {},
          created_at: a.created_at && !Number.isNaN(Date.parse(a.created_at)) ? a.created_at : new Date(`${a.date}T09:00:00Z`).toISOString(),
        },
        userId,
      ),
    );
  }

  // ---- что уже есть ----
  const dates = [...new Set([...sessions.keys(), ...activities.map((a) => a.date as string)])].sort();
  const [existingSessionRows, existingActRows, existingAchRows] = dates.length
    ? await Promise.all([
        fetchAll(() => db.from('sessions').select('date,steps_done,breath').eq('user_id', userId).gte('date', dates[0]).lte('date', dates[dates.length - 1]).order('date')),
        fetchAll(() => db.from('activities').select('id,date,kind,ref').eq('user_id', userId).gte('date', dates[0]).lte('date', dates[dates.length - 1]).order('id')),
        fetchAll(() => db.from('achievements').select('code').eq('user_id', userId).order('code')),
      ])
    : [[], [], await fetchAll(() => db.from('achievements').select('code').eq('user_id', userId).order('code'))];

  const existingSessions = new Map<string, Row>(existingSessionRows.map((r) => [String(r.date).slice(0, 10), r]));
  const existingActs = new Set(existingActRows.map((r) => actKey(String(r.date).slice(0, 10), r.kind, r.ref)));
  const existingIds = new Set(existingActRows.map((r) => r.id as string));
  const existingAch = new Set(existingAchRows.map((r) => r.code as string));

  const newSessions = [...sessions].filter(([d]) => !existingSessions.has(d));
  const mergeSessions: { date: string; patch: Row }[] = [];
  for (const [date, fields] of sessions) {
    const ex = existingSessions.get(date);
    if (!ex) continue;
    const patch: Row = {};
    const have: number[] = Array.isArray(ex.steps_done) ? ex.steps_done : [];
    const add: number[] = Array.isArray(fields.steps_done) ? fields.steps_done : [];
    const union = [...new Set([...have, ...add])].sort((a, b) => a - b);
    if (union.length !== have.length) patch.steps_done = union;
    if (ex.breath == null && fields.breath != null) patch.breath = fields.breath;
    if (Object.keys(patch).length) mergeSessions.push({ date, patch });
  }
  const newActs = activities.filter((a) => !existingActs.has(actKey(a.date, a.kind, a.ref)) && !existingIds.has(a.id));
  const newAch = (parsed.achievements ?? []).filter(
    (a, i, arr) => a && typeof a.code === 'string' && a.code && !existingAch.has(a.code) && arr.findIndex((x) => x?.code === a.code) === i,
  );
  const wantMode = !opts.onboarded && (parsed.defaultMode === 'full' || parsed.defaultMode === 'exp') ? parsed.defaultMode : null;

  const summary: ImportSummary = {
    dryRun: opts.dryRun,
    newDays: newSessions.length,
    existingDays: sessions.size - newSessions.length,
    achievements: newAch.length,
    steps: [...sessions.values()].reduce((n, f) => n + (Array.isArray(f.steps_done) ? f.steps_done.length : 0), 0),
    activities: newActs.length,
    mergedDays: mergeSessions.length,
    skipped,
    defaultModeSet: !!wantMode,
  };
  if (opts.dryRun) return summary;

  // ---- запись ----
  for (let i = 0; i < newSessions.length; i += CHUNK) {
    const rows = newSessions.slice(i, i + CHUNK).map(([date, f]) => ({ user_id: userId, date, ...f }));
    const { error } = await db.from('sessions').upsert(rows, { onConflict: 'user_id,date', ignoreDuplicates: true });
    if (error) throw dbErr(error.message);
  }
  for (const m of mergeSessions) {
    const { error } = await db.from('sessions').update(m.patch).eq('user_id', userId).eq('date', m.date);
    if (error) throw dbErr(error.message);
  }
  for (let i = 0; i < newActs.length; i += CHUNK) {
    const { error } = await db.from('activities').upsert(newActs.slice(i, i + CHUNK), { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw dbErr(error.message);
  }
  if (newAch.length) {
    const now = new Date().toISOString();
    const rows = newAch.map((a) => ({
      user_id: userId,
      code: a.code,
      unlocked_at: a.unlocked_at && !Number.isNaN(Date.parse(a.unlocked_at)) ? a.unlocked_at : now,
      source: 'legacy',
    }));
    const { error } = await db.from('achievements').upsert(rows, { onConflict: 'user_id,code', ignoreDuplicates: true });
    if (error) throw dbErr(error.message);
  }
  if (wantMode) {
    const { error } = await db.from('profiles').update({ default_mode: wantMode }).eq('user_id', userId);
    if (error) throw dbErr(error.message);
  }
  return summary;
}
