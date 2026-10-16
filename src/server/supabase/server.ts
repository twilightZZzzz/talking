import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Клиент от имени пользователя (RLS). Для Server Components и Route Handlers. */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(url(), anonKey(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // вызов из Server Component — cookie обновит proxy
        }
      },
    },
  });
}

/** Привилегированный клиент (service role). Только сервер, только после проверки пользователя. */
export function supabaseAdmin() {
  return createClient(url(), process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
