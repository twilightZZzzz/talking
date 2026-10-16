import { NextResponse, type NextRequest } from 'next/server';
import { isEmailAllowed } from '@/server/auth';
import { supabaseServer } from '@/server/supabase/server';

/** Возврат из Google: обмениваем code на сессию и уходим в приложение. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const fail = (reason: string) => NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(reason)}`);
  if (!code) return fail(searchParams.get('error_description') ?? 'Вход отменён');

  const db = await supabaseServer();
  const { data, error } = await db.auth.exchangeCodeForSession(code);
  if (error) return fail('Не удалось войти через Google. Попробуй ещё раз');
  if (!isEmailAllowed(data.user?.email)) {
    await db.auth.signOut();
    return fail('Для этого аккаунта вход закрыт');
  }
  return NextResponse.redirect(`${origin}/`);
}
