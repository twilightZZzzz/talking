// Импорт прогресса из legacy-прототипа: base64(UTF-8 JSON {log, done, ach, breath, mode}).
import { z } from 'zod';
import { ACHIEVEMENTS } from '../gamification/achievements';
import { RITUAL_STEP_MINUTES } from '../gamification/calc';
import type { Achievement, Activity, ISODate, Mode, Session } from '../types';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const date = z.string().regex(DATE);

const legacySchema = z.object({
  log: z.record(
    date,
    z.object({
      f: z.number().min(0),
      r: z.number().min(0).max(5).default(0),
      n: z.string().nullish(),
      ch: z.boolean().nullish(),
      full: z.boolean().nullish(),
      t: z.number().min(0).max(23).nullish(),
    }),
  ),
  done: z.record(date, z.array(z.number().int().min(0).max(4))).default({}),
  ach: z.record(z.string(), z.string()).default({}),
  breath: z.record(date, z.number().min(0)).default({}),
  mode: z.enum(['full', 'exp']).default('full'),
});

export type LegacyExport = z.infer<typeof legacySchema>;

export interface LegacyImport {
  sessions: Session[];
  activities: Activity[];
  achievements: Achievement[];
  defaultMode: Mode;
}

/** base64 → UTF-8 → JSON. Работает в браузере и Node (atob + TextDecoder) */
export function decodeLegacyCode(code: string): unknown {
  const bin = atob(code.replace(/\s+/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder('utf-8').decode(bytes));
}

/** Стабильный псевдо-uuid из строки (cyrb128 → формат uuid v5) */
export function stableUuid(input: string): string {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < input.length; i++) {
    const k = input.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  const hex = [h1, h2, h3, h4].map((n) => (n >>> 0).toString(16).padStart(8, '0')).join('');
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function parseLegacyExport(code: string): LegacyImport {
  let raw: unknown;
  try {
    raw = decodeLegacyCode(code.trim());
  } catch {
    throw new Error('Код не читается. Скопируй его заново целиком.');
  }
  const parsed = legacySchema.safeParse(raw);
  if (!parsed.success) throw new Error('Это не код из старой версии: ' + parsed.error.issues[0]?.message);
  const d = parsed.data;

  const dates = [...new Set([...Object.keys(d.log), ...Object.keys(d.done), ...Object.keys(d.breath)])].sort();
  const sessions: Session[] = [];
  const activities: Activity[] = [];
  for (const dt of dates as ISODate[]) {
    const e = d.log[dt];
    const steps = [...new Set(d.done[dt] ?? [])].sort((a, b) => a - b);
    const hour = e?.t ?? null;
    const b = d.breath[dt];
    sessions.push({
      date: dt,
      mode: d.mode,
      topic_id: null,
      custom_topic: null,
      frame_id: null,
      challenge_id: null,
      twister_id: null,
      content_version: 0,
      steps_done: steps,
      breath: b ? b : null,
      fillers: e ? e.f : null,
      clarity: e && e.r > 0 ? e.r : null,
      challenge_done: e ? !!e.ch : null,
      note: e?.n ? e.n : null,
      saved_at: e ? `${dt}T${String(hour ?? 12).padStart(2, '0')}:00:00+05:00` : null,
      saved_hour: hour,
      full: !!e?.full,
    });
    for (const i of steps) {
      activities.push({
        id: stableUuid(`legacy:${dt}:ritual_step:${i}`),
        date: dt,
        kind: 'ritual_step',
        ref: String(i),
        duration_s: (RITUAL_STEP_MINUTES[i] ?? 0) * 60,
        meta: { legacy: true },
        created_at: `${dt}T12:00:00.000Z`,
      });
    }
  }

  const known = new Set(ACHIEVEMENTS.map((a) => a.id));
  const achievements: Achievement[] = Object.entries(d.ach)
    .filter(([c, at]) => known.has(c) && DATE.test(at.slice(0, 10)))
    .map(([c, at]) => ({ code: c, unlocked_at: `${at.slice(0, 10)}T12:00:00.000Z`, source: 'legacy' as const }));

  return { sessions, activities, achievements, defaultMode: d.mode };
}
