import { metricEvents } from '@/domain/problems/events';
import { computeMetrics } from '@/domain/speech/metrics';
import { AiError } from '@/server/ai/errors';
import { transcribe } from '@/server/ai/transcribe';
import { requireUser } from '@/server/auth';
import { supabaseAdmin } from '@/server/supabase/server';
import { fail, isUuid, ok } from '@/server/takes/http';
import { failTake, getTakeRow, LOCK_TRANSCRIBE_MS, NO_SPEECH, rowToTake } from '@/server/takes/repo';

export const maxDuration = 300;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireUser();
  if ('error' in a) return a.error;
  const { user, db } = a;
  const { id } = await ctx.params;
  if (!isUuid(id)) return fail('Дубль не найден.', 404);

  const row = await getTakeRow(db, user.id, id);
  if (!row) return fail('Дубль не найден.', 404);
  const past =
    ['transcribed', 'analyzing', 'done'].includes(row.status) || (row.status === 'failed' && row.failed_stage === 'feedback' && row.transcript);
  if (past) return ok(rowToTake(row));

  const now = new Date();
  const { data: claimed } = await db
    .from('takes')
    .update({ status: 'transcribing', locked_until: new Date(now.getTime() + LOCK_TRANSCRIBE_MS).toISOString(), error: null, failed_stage: null })
    .eq('id', id)
    .eq('user_id', user.id)
    .or(`status.in.(created,uploaded,failed),and(status.eq.transcribing,locked_until.lt.${now.toISOString()})`)
    .select('*')
    .maybeSingle();
  if (!claimed) {
    const cur = await getTakeRow(db, user.id, id);
    return cur ? ok(rowToTake(cur)) : fail('Дубль не найден.', 404);
  }

  const fin = async (message: string) => {
    const r = await failTake(db, user.id, id, 'transcribe', message);
    return ok(rowToTake(r ?? { ...claimed, status: 'failed', failed_stage: 'transcribe', error: message }));
  };

  try {
    if (!claimed.audio_path) return await fin('Звук дубля не найден. Запиши ещё раз.');
    const { data: blob, error: dlErr } = await supabaseAdmin().storage.from('audio').download(claimed.audio_path);
    if (dlErr || !blob) return await fin('Звук не успел загрузиться. Проверь интернет и попробуй ещё раз.');

    const ext = String(claimed.audio_path).split('.').pop() ?? 'webm';
    const duration = Number(claimed.duration_s) || 0;
    const res = await transcribe({ audio: blob, filename: `${id}.${ext}`, mime: claimed.mime ?? 'audio/webm', duration_s: duration });
    if (!res.text.trim() || res.words.length < 2) return await fin(NO_SPEECH);

    const excluded: number[] = claimed.fillers_excluded ?? [];
    const dur = duration || res.words[res.words.length - 1].end;
    const metrics = computeMetrics(res.words, dur, excluded);

    const { data: saved, error: saveErr } = await db
      .from('takes')
      .update({
        transcript: res.text,
        words: res.words,
        metrics,
        asr_model: res.model,
        status: 'transcribed',
        locked_until: null,
        error: null,
        failed_stage: null,
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single();
    if (saveErr || !saved) throw new Error(saveErr?.message ?? 'save failed');

    await db.from('problem_events').delete().eq('take_id', id).eq('user_id', user.id);
    const events = metricEvents(metrics, new Date().toISOString()).map((e) => ({ ...e, user_id: user.id, take_id: id }));
    if (events.length) await db.from('problem_events').insert(events);

    return ok(rowToTake(saved));
  } catch (e) {
    console.error('[transcribe]', id, e instanceof Error ? e.message : e);
    return await fin(e instanceof AiError ? e.message : 'Не удалось распознать речь. Попробуй ещё раз.');
  }
}
