import type { SupabaseClient } from '@supabase/supabase-js';
import { buildProfile } from '../../domain/problems/events';
import type { ProblemEvent, ProblemCode, ProblemProfile, Take } from '../../domain/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export const LOCK_TRANSCRIBE_MS = 3 * 60_000;
export const LOCK_FEEDBACK_MS = 4 * 60_000;
export const MAX_TAKES_PER_DAY = 30;
export const MAX_IN_FLIGHT = 2;
export const MAX_DURATION_S = 150;
export const NO_SPEECH = 'Не слышно речи. Проверь микрофон и запиши ещё раз';

export function rowToTake(r: Row): Take {
  return {
    id: r.id,
    session_date: r.session_date,
    take_no: r.take_no,
    context: r.context,
    exercise_id: r.exercise_id ?? null,
    topic: r.topic ?? null,
    frame_id: r.frame_id ?? null,
    challenge_id: r.challenge_id ?? null,
    source: r.source,
    duration_s: r.duration_s == null ? null : Number(r.duration_s),
    status: r.status,
    failed_stage: r.failed_stage ?? null,
    error: r.error ?? null,
    transcript: r.transcript ?? null,
    words: r.words ?? null,
    metrics: r.metrics ?? null,
    feedback: r.feedback ?? null,
    fillers_excluded: r.fillers_excluded ?? [],
    created_at: r.created_at,
    analyzed_at: r.analyzed_at ?? null,
  };
}

export async function getTakeRow(db: SupabaseClient, userId: string, id: string): Promise<Row | null> {
  const { data } = await db.from('takes').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
  return data ?? null;
}

export async function failTake(db: SupabaseClient, userId: string, id: string, stage: 'transcribe' | 'feedback', message: string): Promise<Row | null> {
  const { data } = await db
    .from('takes')
    .update({ status: 'failed', failed_stage: stage, error: message, locked_until: null })
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .maybeSingle();
  return data ?? null;
}

export interface ProblemData {
  events: ProblemEvent[];
  selfProblems: ProblemCode[];
  profile: ProblemProfile;
}

/** События за 60 дней + самооценка → профиль проблем */
export async function loadProblemData(db: SupabaseClient, userId: string, excludeTakeId?: string): Promise<ProblemData> {
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const [ev, pr] = await Promise.all([
    db
      .from('problem_events')
      .select('code, severity, evidence, created_at, take_id')
      .eq('user_id', userId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(2000),
    db.from('profiles').select('self_problems').eq('user_id', userId).maybeSingle(),
  ]);
  const events = ((ev.data ?? []) as Row[])
    .filter((e) => !excludeTakeId || e.take_id !== excludeTakeId)
    .map((e) => ({ code: e.code, severity: e.severity, evidence: e.evidence ?? {}, created_at: e.created_at, take_id: e.take_id })) as ProblemEvent[];
  const selfProblems = ((pr.data?.self_problems ?? []) as ProblemCode[]) ?? [];
  return { events, selfProblems, profile: buildProfile(events, selfProblems, new Date()) };
}
