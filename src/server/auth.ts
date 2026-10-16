import 'server-only';
import { NextResponse } from 'next/server';
import { supabaseServer } from './supabase/server';

export function isEmailAllowed(email: string | undefined | null): boolean {
  const list = (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!list.length) return true;
  return !!email && list.includes(email.toLowerCase());
}

/** Проверенный пользователь для Route Handler. Возвращает либо {user, db}, либо готовый 401-ответ. */
export async function requireUser() {
  const db = await supabaseServer();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user || !isEmailAllowed(data.user.email)) {
    return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) } as const;
  }
  return { user: data.user, db } as const;
}
