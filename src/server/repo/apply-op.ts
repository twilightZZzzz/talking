import type { SupabaseClient } from '@supabase/supabase-js';
import { activityToRow, sessionFieldsToRow } from './mappers';
import type { ParsedSyncOp } from './sync-schema';

const dbErr = (m: string) => new Error(`Ошибка базы данных: ${m}`);

/** Применяет одну операцию от имени пользователя. Бросает Error с русским текстом. */
export async function applyOp(db: SupabaseClient, userId: string, op: ParsedSyncOp): Promise<void> {
  switch (op.op) {
    case 'profile.patch': {
      if (!Object.keys(op.fields).length) return;
      const { error } = await db.from('profiles').update(op.fields).eq('user_id', userId);
      if (error) throw dbErr(error.message);
      return;
    }
    case 'session.patch': {
      // upsert по (user_id,date): при вставке недостающие колонки берут дефолты БД,
      // при обновлении меняются только переданные поля
      const row = { user_id: userId, date: op.date, ...sessionFieldsToRow(op.fields) };
      const { error } = await db.from('sessions').upsert(row, { onConflict: 'user_id,date' });
      if (error) throw dbErr(error.message);
      return;
    }
    case 'activity.upsert': {
      const a = { ...op.activity, meta: op.activity.meta as Record<string, unknown> };
      const { error } = await db.from('activities').upsert(activityToRow(a, userId), { onConflict: 'id' });
      // 23505 = нарушение уникального индекса: шаг ритуала / дубль уже записаны другой строкой
      if (error && !(error.code === '23505' && (a.kind === 'ritual_step' || a.kind === 'take'))) throw dbErr(error.message);
      return;
    }
    case 'activity.delete': {
      const { error } = await db.from('activities').delete().eq('id', op.id).eq('user_id', userId);
      if (error) throw dbErr(error.message);
      return;
    }
    case 'achievement.unlock': {
      const { error } = await db
        .from('achievements')
        .upsert({ user_id: userId, code: op.code, unlocked_at: op.unlocked_at, source: 'calc' }, { onConflict: 'user_id,code', ignoreDuplicates: true });
      if (error) throw dbErr(error.message);
      return;
    }
    case 'plan.done': {
      const { data, error } = await db.from('coach_plans').select('done').eq('id', op.plan_id).eq('user_id', userId).maybeSingle();
      if (error) throw dbErr(error.message);
      if (!data) throw new Error('План не найден');
      const done: string[] = Array.isArray(data.done) ? data.done : [];
      if (done.includes(op.item_id)) return;
      const upd = await db.from('coach_plans').update({ done: [...done, op.item_id] }).eq('id', op.plan_id).eq('user_id', userId);
      if (upd.error) throw dbErr(upd.error.message);
      return;
    }
  }
}
