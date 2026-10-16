import { randomUUID } from 'node:crypto';
import type { CoachPlan, ProblemEvent } from '@/domain/types';
import { generatePlan } from '@/server/ai/plan';
import { requireUser } from '@/server/auth';
import { fail, ok } from '@/server/takes/http';
import { loadProblemData, type Row } from '@/server/takes/repo';

export const maxDuration = 300;

const MIN_INTERVAL_MS = 2 * 60_000;

const toPlan = (r: Row): CoachPlan => ({ id: r.id, created_at: r.created_at, source: r.source, items: r.items ?? [], done: r.done ?? [] });

export async function POST() {
  const a = await requireUser();
  if ('error' in a) return a.error;
  const { user, db } = a;

  const { data: last } = await db
    .from('coach_plans')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last && Date.now() - new Date(last.created_at).getTime() < MIN_INTERVAL_MS) return ok(toPlan(last));

  const [problems, { data: takes }] = await Promise.all([
    loadProblemData(db, user.id),
    db
      .from('takes')
      .select('topic, feedback')
      .eq('user_id', user.id)
      .eq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);
  const rows = (takes ?? []) as Row[];
  const recentTasks = rows.map((t) => t.feedback?.next_task).filter((s): s is string => typeof s === 'string' && !!s);
  const recentTopics = [...new Set(rows.map((t) => t.topic).filter((s): s is string => typeof s === 'string' && !!s))];
  const recentEvents: ProblemEvent[] = problems.events.filter((e) => e.evidence.quote).slice(0, 20);

  const { items, source } = await generatePlan({
    profile: problems.profile,
    recentEvents,
    recentTasks,
    recentTopics,
    seed: randomUUID(),
  });
  if (!items.length) return fail('Не удалось составить план. Попробуй ещё раз позже.', 500);

  const { data: saved, error } = await db
    .from('coach_plans')
    .insert({ user_id: user.id, source, profile: problems.profile, items })
    .select('*')
    .single();
  if (error || !saved) {
    console.error('[coach/plan] insert', error?.message);
    return fail('Не удалось сохранить план. Попробуй ещё раз.', 500);
  }
  return ok(toPlan(saved));
}
