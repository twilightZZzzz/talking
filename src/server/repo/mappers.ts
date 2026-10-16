// Мапперы строк БД (snake_case, PostgREST) ↔ типы домена. Без server-only — тестируются в vitest.
import type {
  Achievement,
  Activity,
  ActivityKind,
  CoachPlan,
  ISODate,
  Mode,
  PlanItem,
  ProblemCode,
  ProblemEvent,
  Profile,
  Session,
  TakeSummary,
  Theme,
} from '@/domain/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

/** date / timestamptz → 'YYYY-MM-DD' */
export function toISODate(v: unknown): ISODate {
  return String(v ?? '').slice(0, 10);
}
const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const intArray = (v: unknown): number[] => (Array.isArray(v) ? v.map(Number).filter(Number.isFinite) : []);
const MODES: readonly string[] = ['full', 'exp'];
const THEMES: readonly string[] = ['system', 'light', 'dark'];
const mode = (v: unknown): Mode => (MODES.includes(v as string) ? (v as Mode) : 'full');
const theme = (v: unknown): Theme => (THEMES.includes(v as string) ? (v as Theme) : 'system');

export function rowToProfile(r: Row): Profile {
  return {
    user_id: String(r.user_id),
    timezone: strOrNull(r.timezone) ?? 'Asia/Yekaterinburg',
    daily_goal_min: numOrNull(r.daily_goal_min) ?? 15,
    default_mode: mode(r.default_mode),
    theme: theme(r.theme),
    self_problems: (Array.isArray(r.self_problems) ? r.self_problems : []) as ProblemCode[],
    onboarded: !!r.onboarded,
  };
}

export function rowToSession(r: Row): Session {
  return {
    date: toISODate(r.date),
    mode: mode(r.mode),
    topic_id: strOrNull(r.topic_id),
    custom_topic: strOrNull(r.custom_topic),
    frame_id: strOrNull(r.frame_id),
    challenge_id: strOrNull(r.challenge_id),
    twister_id: strOrNull(r.twister_id),
    content_version: numOrNull(r.content_version) ?? 1,
    steps_done: intArray(r.steps_done),
    breath: numOrNull(r.breath),
    fillers: numOrNull(r.fillers),
    clarity: numOrNull(r.clarity),
    challenge_done: typeof r.challenge_done === 'boolean' ? r.challenge_done : null,
    note: strOrNull(r.note),
    saved_at: strOrNull(r.saved_at),
    saved_hour: numOrNull(r.saved_hour),
    full: !!r.full,
  };
}

export function rowToActivity(r: Row): Activity {
  return {
    id: String(r.id),
    date: toISODate(r.date),
    kind: r.kind as ActivityKind,
    ref: String(r.ref ?? ''),
    duration_s: numOrNull(r.duration_s) ?? 0,
    meta: r.meta && typeof r.meta === 'object' && !Array.isArray(r.meta) ? r.meta : {},
    created_at: String(r.created_at ?? ''),
  };
}

/** Колонки takes для сводки (без words и transcript). */
export const TAKE_SUMMARY_COLUMNS =
  'id,session_date,take_no,context,exercise_id,topic,frame_id,challenge_id,source,duration_s,status,failed_stage,error,metrics,feedback,fillers_excluded,created_at,analyzed_at';

export function rowToTakeSummary(r: Row): TakeSummary {
  return {
    id: String(r.id),
    session_date: toISODate(r.session_date),
    take_no: numOrNull(r.take_no) ?? 1,
    context: r.context ?? 'free',
    exercise_id: strOrNull(r.exercise_id),
    topic: strOrNull(r.topic),
    frame_id: strOrNull(r.frame_id),
    challenge_id: strOrNull(r.challenge_id),
    source: r.source === 'upload' ? 'upload' : 'record',
    duration_s: numOrNull(r.duration_s),
    status: r.status ?? 'created',
    failed_stage: strOrNull(r.failed_stage),
    error: strOrNull(r.error),
    metrics: r.metrics ?? null,
    feedback: r.feedback ?? null,
    fillers_excluded: intArray(r.fillers_excluded),
    created_at: String(r.created_at ?? ''),
    analyzed_at: strOrNull(r.analyzed_at),
  };
}

export function rowToProblemEvent(r: Row): ProblemEvent {
  return {
    code: r.code as ProblemCode,
    severity: numOrNull(r.severity) ?? 0,
    evidence: r.evidence && typeof r.evidence === 'object' && !Array.isArray(r.evidence) ? r.evidence : {},
    created_at: String(r.created_at ?? ''),
    take_id: strOrNull(r.take_id),
  };
}

export function rowToCoachPlan(r: Row): CoachPlan {
  return {
    id: String(r.id),
    created_at: String(r.created_at ?? ''),
    source: r.source === 'ai' ? 'ai' : 'rules',
    items: (Array.isArray(r.items) ? r.items : []) as PlanItem[],
    done: Array.isArray(r.done) ? r.done.map(String) : [],
  };
}

export function rowToAchievement(r: Row): Achievement {
  return {
    code: String(r.code),
    unlocked_at: String(r.unlocked_at ?? ''),
    source: r.source === 'legacy' ? 'legacy' : 'calc',
  };
}

// ---------- доменные поля → колонки БД ----------

/** Поля Session → колонки (только переданные; undefined отбрасываются). */
export function sessionFieldsToRow(fields: Partial<Omit<Session, 'date'>>): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) out[k] = v;
  return out;
}

export function activityToRow(a: Activity, userId: string): Row {
  return {
    id: a.id,
    user_id: userId,
    date: a.date,
    kind: a.kind,
    ref: a.ref ?? '',
    duration_s: Math.max(0, Math.round(a.duration_s ?? 0)),
    meta: a.meta ?? {},
    created_at: a.created_at,
  };
}
