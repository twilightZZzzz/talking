// zod-схемы операций /api/sync. Без server-only — тестируются в vitest.
import { z } from 'zod';
import type { ProblemCode } from '@/domain/types';

export const PROBLEM_CODES = [
  'fillers',
  'pace_fast',
  'pace_slow',
  'few_pauses',
  'slow_start',
  'detours',
  'frame_gaps',
  'frame_order',
  'run_on',
  'weak_ending',
  'vague',
  'repetitions',
] as const satisfies readonly ProblemCode[];
// проверка полноты: если в ProblemCode добавят код, здесь будет ошибка типов
const _exhaustive: ProblemCode extends (typeof PROBLEM_CODES)[number] ? true : never = true;
void _exhaustive;

export const MAX_OPS = 200;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата должна быть в формате ГГГГ-ММ-ДД').refine(
  (s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  },
  'Несуществующая дата',
);
const isoDateTime = z.string().refine((s) => !Number.isNaN(Date.parse(s)) && /^\d{4}-\d{2}-\d{2}/.test(s), 'Неверные дата и время');
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Неверный идентификатор');
const mode = z.enum(['full', 'exp']);
const text = (max: number) => z.string().max(max).nullable();

export const profileFieldsSchema = z.object({
  timezone: z.string().min(1).max(64).optional(),
  daily_goal_min: z.number().int().min(5, 'Цель дня — от 5 минут').max(240, 'Цель дня — до 240 минут').optional(),
  default_mode: mode.optional(),
  theme: z.enum(['system', 'light', 'dark']).optional(),
  self_problems: z.array(z.enum(PROBLEM_CODES)).max(PROBLEM_CODES.length).optional(),
  onboarded: z.boolean().optional(),
});

export const stepsDoneSchema = z
  .array(z.number().int().min(0).max(4))
  .max(5)
  .refine((a) => new Set(a).size === a.length, 'Шаги не должны повторяться');

export const sessionFieldsSchema = z.object({
  mode: mode.optional(),
  topic_id: text(100).optional(),
  custom_topic: text(500).optional(),
  frame_id: text(100).optional(),
  challenge_id: text(100).optional(),
  twister_id: text(100).optional(),
  content_version: z.number().int().min(1).max(1000).optional(),
  steps_done: stepsDoneSchema.optional(),
  breath: z.number().int().min(0).max(100_000).nullable().optional(),
  fillers: z.number().int().min(0).max(10_000).nullable().optional(),
  clarity: z.number().int().min(1, 'Ясность — от 1 до 5').max(5, 'Ясность — от 1 до 5').nullable().optional(),
  challenge_done: z.boolean().nullable().optional(),
  note: text(5000).optional(),
  saved_at: isoDateTime.nullable().optional(),
  saved_hour: z.number().int().min(0).max(23).nullable().optional(),
  full: z.boolean().optional(),
});

export const activitySchema = z.object({
  id: uuid,
  date: isoDate,
  kind: z.enum(['ritual_step', 'drill', 'take', 'day_saved', 'legacy']),
  ref: z.string().max(200),
  duration_s: z.number().min(0).max(86_400),
  meta: z.record(z.string(), z.unknown()).default({}),
  created_at: isoDateTime,
});

const opId = z.string().min(1).max(100);

export const syncOpSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('profile.patch'), op_id: opId, fields: profileFieldsSchema }),
  z.object({ op: z.literal('session.patch'), op_id: opId, date: isoDate, fields: sessionFieldsSchema }),
  z.object({ op: z.literal('activity.upsert'), op_id: opId, activity: activitySchema }),
  z.object({ op: z.literal('activity.delete'), op_id: opId, id: uuid }),
  z.object({ op: z.literal('achievement.unlock'), op_id: opId, code: z.string().min(1).max(64), unlocked_at: isoDateTime }),
  z.object({ op: z.literal('plan.done'), op_id: opId, plan_id: uuid, item_id: z.string().min(1).max(100) }),
]);

export type ParsedSyncOp = z.infer<typeof syncOpSchema>;

/** Тело запроса: ops — массив до MAX_OPS; каждая операция валидируется отдельно. */
export const syncBodySchema = z.object({ ops: z.array(z.unknown()).max(MAX_OPS, `Не больше ${MAX_OPS} операций за запрос`) });

export function readOpId(raw: unknown, index: number): string {
  const id = (raw as { op_id?: unknown } | null)?.op_id;
  return typeof id === 'string' && id ? id : `#${index}`;
}

export function formatZodError(e: z.ZodError): string {
  return e.issues.map((i) => `${i.path.join('.') || 'операция'}: ${i.message}`).join('; ');
}
