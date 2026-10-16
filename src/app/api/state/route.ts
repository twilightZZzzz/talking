import { NextResponse } from 'next/server';
import type { AppState } from '@/domain/types';
import { aiStatus } from '@/server/ai/config';
import { requireUser } from '@/server/auth';
import { ensureProfile } from '@/server/repo/ensure-profile';
import {
  TAKE_SUMMARY_COLUMNS,
  rowToAchievement,
  rowToActivity,
  rowToCoachPlan,
  rowToProblemEvent,
  rowToSession,
  rowToTakeSummary,
} from '@/server/repo/mappers';
import { fetchAll } from '@/server/repo/queries';


export async function GET() {
  const auth = await requireUser();
  if ('error' in auth) return auth.error;
  const { user, db } = auth;

  const since60 = new Date(Date.now() - 61 * 86_400_000).toISOString();

  try {
    const [profile, sessions, activities, takes, events, plan, achievements] = await Promise.all([
      ensureProfile(db, user.id),
      fetchAll(() => db.from('sessions').select('*').eq('user_id', user.id).order('date', { ascending: true })),
      fetchAll(() =>
        db
          .from('activities')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: true })
          .order('created_at', { ascending: true })
          .order('id', { ascending: true }),
      ),
      db.from('takes').select(TAKE_SUMMARY_COLUMNS).eq('user_id', user.id).order('created_at', { ascending: false }).limit(300),
      fetchAll(() =>
        db
          .from('problem_events')
          .select('code,severity,evidence,created_at,take_id,id')
          .eq('user_id', user.id)
          .gte('created_at', since60)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true }),
      ),
      db.from('coach_plans').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      fetchAll(() => db.from('achievements').select('*').eq('user_id', user.id).order('unlocked_at', { ascending: true }).order('code', { ascending: true })),
    ]);
    if (takes.error) throw new Error(takes.error.message);
    if (plan.error) throw new Error(plan.error.message);

    const state: AppState = {
      profile,
      sessions: sessions.map(rowToSession),
      activities: activities.map(rowToActivity),
      // takes пришли новые → старые; для UI отдаём в хронологическом порядке (старые → новые)
      takes: (takes.data ?? []).map(rowToTakeSummary).reverse(),
      problemEvents: events.map(rowToProblemEvent),
      plan: plan.data ? rowToCoachPlan(plan.data) : null,
      achievements: achievements.map(rowToAchievement),
      aiStatus: typeof aiStatus === 'function' ? aiStatus() : aiStatus,
      email: user.email ?? '',
    };
    return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json(
      { error: `Не удалось загрузить данные: ${e instanceof Error ? e.message : 'неизвестная ошибка'}` },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
