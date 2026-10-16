import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile } from '@/domain/types';
import { rowToProfile } from './mappers';

/** Профиль пользователя; создаёт строку, если триггер при регистрации её не создал. */
export async function ensureProfile(db: SupabaseClient, userId: string): Promise<Profile> {
  const sel = () => db.from('profiles').select('*').eq('user_id', userId).maybeSingle();
  const first = await sel();
  if (first.error) throw new Error(first.error.message);
  if (first.data) return rowToProfile(first.data);

  const ins = await db.from('profiles').upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
  if (ins.error) throw new Error(ins.error.message);
  const second = await sel();
  if (second.error || !second.data) throw new Error(second.error?.message ?? 'Не удалось создать профиль');
  return rowToProfile(second.data);
}
