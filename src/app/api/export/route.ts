import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth';
import { ensureProfile } from '@/server/repo/ensure-profile';
import { rowToAchievement, rowToActivity, rowToCoachPlan, rowToProblemEvent, rowToSession } from '@/server/repo/mappers';
import { fetchAll, todayIn } from '@/server/repo/queries';


// takes для экспорта: с transcript и feedback, без words и служебных полей
const TAKE_EXPORT_COLUMNS =
  'id,session_date,take_no,context,exercise_id,topic,frame_id,challenge_id,source,duration_s,status,failed_stage,error,transcript,metrics,feedback,fillers_excluded,asr_model,llm_model,prompt_version,created_at,analyzed_at';

export async function GET() {
  const auth = await requireUser();
  if ('error' in auth) return auth.error;
  const { user, db } = auth;

  try {
    const [profile, sessions, activities, takes, events, plans, achievements] = await Promise.all([
      ensureProfile(db, user.id),
      fetchAll(() => db.from('sessions').select('*').eq('user_id', user.id).order('date', { ascending: true })),
      fetchAll(() => db.from('activities').select('*').eq('user_id', user.id).order('date', { ascending: true }).order('created_at', { ascending: true }).order('id', { ascending: true })),
      fetchAll(() => db.from('takes').select(TAKE_EXPORT_COLUMNS).eq('user_id', user.id).order('created_at', { ascending: true }).order('id', { ascending: true })),
      fetchAll(() => db.from('problem_events').select('code,severity,evidence,created_at,take_id,id').eq('user_id', user.id).order('created_at', { ascending: true }).order('id', { ascending: true })),
      fetchAll(() => db.from('coach_plans').select('*').eq('user_id', user.id).order('created_at', { ascending: true }).order('id', { ascending: true })),
      fetchAll(() => db.from('achievements').select('*').eq('user_id', user.id).order('unlocked_at', { ascending: true }).order('code', { ascending: true })),
    ]);

    const now = new Date();
    const body = {
      version: 2,
      exported_at: now.toISOString(),
      profile,
      sessions: sessions.map(rowToSession),
      activities: activities.map(rowToActivity),
      takes: takes.map(({ user_id: _u, ...t }) => t),
      problem_events: events.map(rowToProblemEvent),
      coach_plans: plans.map((p) => ({ ...rowToCoachPlan(p), profile: p.profile ?? {} })),
      achievements: achievements.map(rowToAchievement),
    };
    const file = `rech-export-${todayIn(profile.timezone, now)}.json`;
    return new NextResponse(JSON.stringify(body, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${file}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: `Не удалось выгрузить данные: ${e instanceof Error ? e.message : 'неизвестная ошибка'}` }, { status: 500 });
  }
}
