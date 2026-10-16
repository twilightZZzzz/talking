import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { parseLegacyExport } from '@/domain/legacy';
import { requireUser } from '@/server/auth';
import { ensureProfile } from '@/server/repo/ensure-profile';
import { runLegacyImport, type LegacyParsed } from '@/server/repo/legacy-import';

export const runtime = 'nodejs';

const bodySchema = z.object({
  code: z.string().min(1, 'Вставь код экспорта из старой версии').max(2_000_000, 'Код слишком длинный'),
  dryRun: z.boolean().optional(),
});

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
  const body = bodySchema.safeParse(json);
  if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message ?? 'Неверный запрос' }, { status: 400 });

  let parsed: LegacyParsed;
  try {
    parsed = parseLegacyExport(body.data.code.trim()) as unknown as LegacyParsed;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error && e.message ? e.message : 'Не удалось прочитать код. Скопируй его целиком из старой версии.' },
      { status: 400 },
    );
  }

  try {
    const profile = await ensureProfile(db, user.id);
    const summary = await runLegacyImport(db, user.id, parsed, { dryRun: !!body.data.dryRun, onboarded: profile.onboarded });
    return NextResponse.json(summary, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Не удалось импортировать данные' }, { status: 500 });
  }
}
