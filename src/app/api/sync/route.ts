import { NextResponse, type NextRequest } from 'next/server';
import type { SyncResponse } from '@/domain/sync';
import { requireUser } from '@/server/auth';
import { applyOp } from '@/server/repo/apply-op';
import { ensureProfile } from '@/server/repo/ensure-profile';
import { formatZodError, readOpId, syncBodySchema, syncOpSchema } from '@/server/repo/sync-schema';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ('error' in auth) return auth.error;
  const { user, db } = auth;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 });
  }
  const body = syncBodySchema.safeParse(json);
  if (!body.success) return NextResponse.json({ error: formatZodError(body.error) }, { status: 400 });

  const res: SyncResponse = { applied: [], failed: [] };
  if (!body.data.ops.length) return NextResponse.json(res, { headers: { 'Cache-Control': 'no-store' } });

  try {
    await ensureProfile(db, user.id);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка профиля' }, { status: 500 });
  }

  // последовательно, чтобы сохранить порядок операций клиента; ошибка одной не валит остальные
  for (const [i, raw] of body.data.ops.entries()) {
    const opId = readOpId(raw, i);
    const parsed = syncOpSchema.safeParse(raw);
    if (!parsed.success) {
      res.failed.push({ op_id: opId, error: `Неверная операция: ${formatZodError(parsed.error)}` });
      continue;
    }
    try {
      await applyOp(db, user.id, parsed.data);
      res.applied.push(opId);
    } catch (e) {
      res.failed.push({ op_id: opId, error: e instanceof Error ? e.message : 'Неизвестная ошибка' });
    }
  }
  return NextResponse.json(res, { headers: { 'Cache-Control': 'no-store' } });
}
