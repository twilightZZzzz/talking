import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { supabaseAdmin } from '@/server/supabase/server';
import { fail, ok, readJson } from '@/server/takes/http';
import { MAX_DURATION_S, MAX_IN_FLIGHT, MAX_TAKES_PER_DAY } from '@/server/takes/repo';

const Body = z.object({
  id: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
  session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  context: z.enum(['ritual', 'free', 'drill', 'plan']),
  exercise_id: z.string().max(100).nullish(),
  topic: z.string().max(400).nullish(),
  frame_id: z.string().max(100).nullish(),
  challenge_id: z.string().max(100).nullish(),
  source: z.enum(['record', 'upload']),
  mime: z.string().max(120),
  duration_s: z.number().finite(),
});

const EXT: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
};

export async function POST(req: Request) {
  const a = await requireUser();
  if ('error' in a) return a.error;
  const { user, db } = a;

  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return fail('Некорректные данные дубля.');
  const b = parsed.data;

  const mime = b.mime.split(';')[0].trim().toLowerCase();
  if (!mime.startsWith('audio/')) return fail('Нужен звук (audio/*). Видео на сервер не отправляется.');
  const ext = EXT[mime];
  if (!ext) return fail('Этот формат звука не поддерживается. Запиши дубль прямо в приложении.');
  if (b.duration_s <= 0) return fail('Не удалось определить длительность записи.');
  if (b.duration_s > MAX_DURATION_S + 1) return fail('Дубль длиннее 2:30. Запиши покороче.');

  const path = `${user.id}/${b.id}.${ext}`;
  let takeNo: number;

  const { data: existing } = await db.from('takes').select('take_no').eq('id', b.id).eq('user_id', user.id).maybeSingle();
  if (existing) {
    takeNo = existing.take_no;
  } else {
    const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
    const nowIso = new Date().toISOString();
    const [{ count: dayCount }, { count: inFlight }, { data: last }] = await Promise.all([
      db.from('takes').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', dayAgo),
      db
        .from('takes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('status', ['transcribing', 'analyzing'])
        .gt('locked_until', nowIso),
      db
        .from('takes')
        .select('take_no')
        .eq('user_id', user.id)
        .eq('session_date', b.session_date)
        .order('take_no', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if ((dayCount ?? 0) >= MAX_TAKES_PER_DAY) return fail('Лимит — 30 дублей в сутки. Продолжим завтра.', 429);
    if ((inFlight ?? 0) >= MAX_IN_FLIGHT) return fail('Два дубля уже разбираются. Подожди, пока они закончатся.', 429);

    takeNo = (last?.take_no ?? 0) + 1;
    const { error } = await db.from('takes').insert({
      id: b.id,
      user_id: user.id,
      session_date: b.session_date,
      take_no: takeNo,
      context: b.context,
      exercise_id: b.exercise_id ?? null,
      topic: b.topic ?? null,
      frame_id: b.frame_id ?? null,
      challenge_id: b.challenge_id ?? null,
      source: b.source,
      audio_path: path,
      mime,
      duration_s: b.duration_s,
      status: 'created',
    });
    if (error) {
      console.error('[takes] insert', error.message);
      return fail('Не удалось создать дубль. Попробуй ещё раз.', 500);
    }
  }

  const { data: up, error: upErr } = await supabaseAdmin().storage.from('audio').createSignedUploadUrl(path, { upsert: true });
  if (upErr || !up) {
    console.error('[takes] signed url', upErr?.message);
    return fail('Не удалось подготовить загрузку звука. Попробуй ещё раз.', 500);
  }
  return ok({ take_no: takeNo, path: up.path ?? path, token: up.token, signedUrl: up.signedUrl });
}
