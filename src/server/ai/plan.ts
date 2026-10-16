import { z } from 'zod';
import { FRAMES, TOPICS } from '../../domain/content';
import * as exercises from '../../domain/exercises';
import { rulesPlan } from '../../domain/exercises';
import { problemInfo } from '../../domain/problems/catalog';
import type { PlanItem, ProblemCode, ProblemEvent, ProblemProfile } from '../../domain/types';
import { llmProvider } from './config';
import { generateJson, type JsonSchema } from './llm';
import { loadPrompt } from './prompts';

export const PLAN_PROMPT_VERSION = 'plan-v1';

export interface GeneratePlanInput {
  profile: ProblemProfile;
  recentEvents: ProblemEvent[];
  recentTasks: string[];
  recentTopics: string[];
  seed: number | string;
}
export interface GeneratePlanResult {
  items: PlanItem[];
  source: 'ai' | 'rules';
}

const CODES = [
  'fillers', 'pace_fast', 'pace_slow', 'few_pauses', 'slow_start', 'detours',
  'frame_gaps', 'frame_order', 'run_on', 'weak_ending', 'vague', 'repetitions',
] as const satisfies readonly ProblemCode[];

export const planSchema = z.object({
  items: z.array(
    z.object({
      title: z.string(),
      why: z.string(),
      targets: z.array(z.enum(CODES)),
      minutes: z.number(),
      speaking: z.boolean(),
      take_s: z.number().nullable(),
      topic: z.string().nullable(),
      frame_id: z.string().nullable(),
      instructions: z.array(z.string()),
      success: z.string(),
      base_exercise_id: z.string().nullable(),
    }),
  ),
});

const str = { type: 'string' };
export const planJsonSchema: JsonSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: str,
          why: str,
          targets: { type: 'array', items: { type: 'string', enum: [...CODES] } },
          minutes: { type: 'integer' },
          speaking: { type: 'boolean' },
          take_s: { type: ['integer', 'null'] },
          topic: { type: ['string', 'null'] },
          frame_id: { type: ['string', 'null'] },
          instructions: { type: 'array', items: str },
          success: str,
          base_exercise_id: { type: ['string', 'null'] },
        },
        required: ['title', 'why', 'targets', 'minutes', 'speaking', 'take_s', 'topic', 'frame_id', 'instructions', 'success', 'base_exercise_id'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
};

export function rules(profile: ProblemProfile, seed: number | string): PlanItem[] {
  return rulesPlan(profile, { seed: typeof seed === 'number' ? seed : hash(seed), now: new Date().toISOString() });
}

export async function generatePlan(input: GeneratePlanInput): Promise<GeneratePlanResult> {
  if (llmProvider() !== 'mock') {
    try {
      const { data } = await generateJson({
        system: loadPrompt('plan.md'),
        user: buildPlanMessage(input),
        schema: planSchema,
        jsonSchema: planJsonSchema,
        maxTokens: 4000,
        name: 'plan',
      });
      const items = sanitizePlan(data.items, input);
      if (items) return { items, source: 'ai' };
    } catch (e) {
      console.error('[plan] ИИ-план не получился, берём правила:', e instanceof Error ? e.message : e);
    }
  }
  return { items: rules(input.profile, input.seed), source: 'rules' };
}

const clean = (s: string) => s.replace(/[<>]/g, '').trim();

export function buildPlanMessage(i: GeneratePlanInput): string {
  const top = i.profile.scores.filter((s) => s.count > 0 || s.score > 0).slice(0, 6);
  const quotes = i.recentEvents
    .filter((e) => e.evidence.quote)
    .slice(0, 8)
    .map((e) => `${e.code} | «${clean(e.evidence.quote!)}»`);
  return [
    `<profile>\nРазобрано дублей: ${i.profile.takesAnalyzed}\n${
      top.map((s) => `${s.code} | ${problemInfo(s.code)?.title ?? s.code} | score ${Math.round(s.score)} | trend ${Math.round(s.trend)} | раз: ${s.count}`).join('\n') || '(данных пока нет)'
    }\n</profile>`,
    `<fillers>\n${i.profile.topFillers.slice(0, 5).map((f) => `«${f.word}» — ${f.count}`).join('\n')}\n</fillers>`,
    `<quotes>\n${quotes.join('\n')}\n</quotes>`,
    `<recent_tasks>\n${i.recentTasks.map(clean).join('\n')}\n</recent_tasks>`,
    `<recent_topics>\n${i.recentTopics.map(clean).join('\n')}\n</recent_topics>`,
    `<library>\n${exercises.EXERCISES.map(
      (e) => `${e.id} | ${e.title} | ${e.minutes} мин | ${e.targets.join(',')} | ${e.speaking ? `речевое ${e.take_s ?? ''}с` : 'без записи'}`,
    ).join('\n')}\n</library>`,
    `<frames>\n${FRAMES.map((f) => `${f.id} | ${f.name}`).join('\n')}\n</frames>`,
  ].join('\n\n');
}

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const hash = (s: string) => [...s].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7);

/** Приводит ответ ИИ к PlanItem[]; null — если не выполнены требования (4–5 пунктов, ≥2 речевых) */
export function sanitizePlan(raw: z.infer<typeof planSchema>['items'], i: GeneratePlanInput): PlanItem[] | null {
  const lib = new Set(exercises.EXERCISES.map((e) => e.id));
  const frames = new Set(FRAMES.map((f) => f.id));
  const tag = hash(String(i.seed)).toString(36);
  const items: PlanItem[] = [];
  for (const r of raw.slice(0, 5)) {
    const instructions = r.instructions.map((s) => s.trim()).filter(Boolean).slice(0, 6);
    if (!r.title.trim() || !instructions.length || !r.success.trim()) continue;
    const item: PlanItem = {
      id: `ai-${tag}-${items.length}`,
      title: r.title.trim(),
      why: r.why.trim(),
      targets: r.targets,
      minutes: clamp(Math.round(r.minutes), 2, 10),
      speaking: r.speaking,
      instructions,
      success: r.success.trim(),
    };
    if (r.speaking) {
      item.take_s = clamp(Math.round(r.take_s ?? 60), 45, 120);
      const topic = r.topic?.trim() || TOPICS[hash(`${tag}${items.length}`) % Math.max(1, TOPICS.length)]?.text;
      if (topic) item.topic = topic;
    }
    if (r.frame_id && frames.has(r.frame_id)) item.frame_id = r.frame_id;
    if (r.base_exercise_id && lib.has(r.base_exercise_id)) item.base_exercise_id = r.base_exercise_id;
    items.push(item);
  }
  if (items.length < 4 || items.filter((x) => x.speaking).length < 2) return null;
  return items;
}
