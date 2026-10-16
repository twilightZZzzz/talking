import { z } from 'zod';
import { metricEvents } from '@/domain/problems/events';
import { computeMetrics } from '@/domain/speech/metrics';
import type { Word } from '@/domain/types';
import { requireUser } from '@/server/auth';
import { fail, isUuid, ok, readJson } from '@/server/takes/http';
import { getTakeRow, rowToTake } from '@/server/takes/repo';

const METRIC_CODES = ['fillers', 'pace_fast', 'pace_slow', 'few_pauses', 'repetitions'];

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireUser();
  if ('error' in a) return a.error;
  const { id } = await ctx.params;
  if (!isUuid(id)) return fail('Дубль не найден.', 404);
  const row = await getTakeRow(a.db, a.user.id, id);
  return row ? ok(rowToTake(row)) : fail('Дубль не найден.', 404);
}

const Patch = z.object({ fillers_excluded: z.array(z.number().int().min(0)).max(2000) });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireUser();
  if ('error' in a) return a.error;
  const { user, db } = a;
  const { id } = await ctx.params;
  if (!isUuid(id)) return fail('Дубль не найден.', 404);

  const body = Patch.safeParse(await readJson(req));
  if (!body.success) return fail('Некорректный список исключённых слов.');
  const row = await getTakeRow(db, user.id, id);
  if (!row) return fail('Дубль не найден.', 404);
  if (!row.words || !row.metrics) return fail('У этого дубля ещё нет распознанной речи.', 409);

  const words = row.words as Word[];
  const excluded = [...new Set(body.data.fillers_excluded)].filter((i) => i < words.length).sort((x, y) => x - y);
  const metrics = computeMetrics(words, Number(row.duration_s) || row.metrics.duration_s, excluded);

  const { data: saved, error } = await db
    .from('takes')
    .update({ fillers_excluded: excluded, metrics })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single();
  if (error || !saved) return fail('Не удалось сохранить правку. Попробуй ещё раз.', 500);

  const { data: act } = await db.from('activities').select('meta').eq('id', id).eq('user_id', user.id).eq('kind', 'take').maybeSingle();
  if (act) {
    await db
      .from('activities')
      .update({ meta: { ...(act.meta ?? {}), fpm: metrics.fpm, fillers: metrics.fillers_count } })
      .eq('id', id)
      .eq('user_id', user.id);
  }

  await db.from('problem_events').delete().eq('take_id', id).eq('user_id', user.id).in('code', METRIC_CODES);
  const events = metricEvents(metrics, row.created_at).map((e) => ({ ...e, user_id: user.id, take_id: id }));
  if (events.length) await db.from('problem_events').insert(events);

  return ok(rowToTake(saved));
}
