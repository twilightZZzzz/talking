import type { SupabaseClient } from '@supabase/supabase-js';
import { getChallenge, getFrame } from '@/domain/content';
import { problemInfo } from '@/domain/problems/catalog';
import type { Feedback, SpeechMetrics, Word } from '@/domain/types';
import { AiError } from '@/server/ai/errors';
import { AI_CODES, aiEvents, analyzeFeedback, type ChronicProblem, type PreviousTake } from '@/server/ai/feedback';
import { locateQuote } from '@/server/ai/text';
import { requireUser } from '@/server/auth';
import { supabaseAdmin } from '@/server/supabase/server';
import { fail, isUuid, ok } from '@/server/takes/http';
import { failTake, getTakeRow, LOCK_FEEDBACK_MS, loadProblemData, rowToTake } from '@/server/takes/repo';

export const maxDuration = 300;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireUser();
  if ('error' in a) return a.error;
  const { user, db } = a;
  const { id } = await ctx.params;
  if (!isUuid(id)) return fail('Дубль не найден.', 404);

  const row = await getTakeRow(db, user.id, id);
  if (!row) return fail('Дубль не найден.', 404);
  if (row.status === 'done') return ok(rowToTake(row));
  if (!row.transcript || !row.words || !row.metrics) {
    return fail('Сначала нужно распознать речь этого дубля.', 409);
  }

  const now = new Date();
  const { data: claimed } = await db
    .from('takes')
    .update({ status: 'analyzing', locked_until: new Date(now.getTime() + LOCK_FEEDBACK_MS).toISOString(), error: null, failed_stage: null })
    .eq('id', id)
    .eq('user_id', user.id)
    .or(
      `status.eq.transcribed,and(status.eq.failed,failed_stage.eq.feedback),and(status.eq.analyzing,locked_until.lt.${now.toISOString()})`,
    )
    .select('*')
    .maybeSingle();
  if (!claimed) {
    const cur = await getTakeRow(db, user.id, id);
    return cur ? ok(rowToTake(cur)) : fail('Дубль не найден.', 404);
  }

  const fin = async (message: string) => {
    const r = await failTake(db, user.id, id, 'feedback', message);
    return ok(rowToTake(r ?? { ...claimed, status: 'failed', failed_stage: 'feedback', error: message }));
  };

  try {
    const words = claimed.words as Word[];
    const metrics = claimed.metrics as SpeechMetrics;

    const [{ data: prev }, problems] = await Promise.all([
      db
        .from('takes')
        .select('metrics, feedback')
        .eq('user_id', user.id)
        .eq('session_date', claimed.session_date)
        .eq('status', 'done')
        .lt('take_no', claimed.take_no)
        .order('take_no', { ascending: false })
        .limit(1)
        .maybeSingle(),
      loadProblemData(db, user.id, id),
    ]);
    const previous: PreviousTake | null = prev
      ? { fpm: prev.metrics?.fpm ?? null, wpm: prev.metrics?.wpm ?? null, next_task: prev.feedback?.next_task ?? null }
      : null;
    const chronic: ChronicProblem[] = problems.profile.scores
      .filter((s) => s.score >= 25)
      .slice(0, 3)
      .map((s) => {
        const info = problemInfo(s.code);
        return {
          code: s.code,
          title: info?.title ?? s.code,
          short: info?.short ?? '',
          score: s.score,
          example: problems.events.find((e) => e.code === s.code && e.evidence.quote)?.evidence.quote,
        };
      });

    const { feedback, model, prompt_version } = await analyzeFeedback({
      take: { id, duration_s: claimed.duration_s == null ? null : Number(claimed.duration_s) },
      metrics,
      words,
      transcript: claimed.transcript,
      frame: getFrame(claimed.frame_id),
      challenge: getChallenge(claimed.challenge_id),
      topic: claimed.topic ?? null,
      previous,
      chronic,
    });

    const { data: saved, error: saveErr } = await db
      .from('takes')
      .update({
        feedback,
        llm_model: model,
        prompt_version,
        analyzed_at: new Date().toISOString(),
        status: 'done',
        locked_until: null,
        error: null,
        failed_stage: null,
        audio_path: null,
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single();
    if (saveErr || !saved) throw new Error(saveErr?.message ?? 'save failed');

    await saveAiEvents(db, user.id, id, feedback, words);

    const meta = { fpm: metrics.fpm, wpm: metrics.wpm, fillers: metrics.fillers_count, clarity: feedback.clarity };
    await db.from('activities').upsert(
      {
        id,
        user_id: user.id,
        date: claimed.session_date,
        kind: 'take',
        ref: id,
        duration_s: Math.round(Number(claimed.duration_s) || metrics.duration_s || 0),
        meta,
      },
      { onConflict: 'id' },
    );

    if (claimed.audio_path) {
      const { error: rmErr } = await supabaseAdmin().storage.from('audio').remove([claimed.audio_path]);
      if (rmErr) console.error('[feedback] удаление звука', rmErr.message);
    }
    return ok(rowToTake(saved));
  } catch (e) {
    console.error('[feedback]', id, e instanceof Error ? e.message : e);
    return await fin(e instanceof AiError ? e.message : 'Не удалось подготовить разбор. Попробуй ещё раз.');
  }
}

async function saveAiEvents(
  db: SupabaseClient,
  userId: string,
  takeId: string,
  fb: Feedback,
  words: Word[],
) {
  await db.from('problem_events').delete().eq('take_id', takeId).eq('user_id', userId).in('code', [...AI_CODES]);
  const rows = aiEvents(fb, (q) => locateQuote(words, q)).map((e) => ({ ...e, user_id: userId, take_id: takeId }));
  if (rows.length) await db.from('problem_events').insert(rows);
}
