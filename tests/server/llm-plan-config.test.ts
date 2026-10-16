import { afterEach, describe, expect, it } from 'vitest';
import { aiStatus, llmProvider } from '../../src/server/ai/config';
import { nullToAnyOf, parseJson } from '../../src/server/ai/llm';
import { feedbackJsonSchema } from '../../src/server/ai/feedback';
import { planJsonSchema, planSchema, sanitizePlan } from '../../src/server/ai/plan';

const KEYS = ['GROQ_API_KEY', 'ANTHROPIC_API_KEY', 'LLM_PROVIDER'] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
afterEach(() => KEYS.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]))));
const setEnv = (e: Partial<Record<(typeof KEYS)[number], string>>) => {
  KEYS.forEach((k) => delete process.env[k]);
  Object.assign(process.env, e);
};

describe('aiStatus', () => {
  it('без ключей — mock', () => {
    setEnv({});
    expect(aiStatus()).toEqual({ transcription: 'mock', llm: 'mock' });
  });
  it('по умолчанию anthropic, иначе groq', () => {
    setEnv({ GROQ_API_KEY: 'g', ANTHROPIC_API_KEY: 'a' });
    expect(aiStatus()).toEqual({ transcription: 'groq', llm: 'anthropic' });
    setEnv({ GROQ_API_KEY: 'g' });
    expect(aiStatus()).toEqual({ transcription: 'groq', llm: 'groq' });
  });
  it('LLM_PROVIDER=groq переопределяет; без ключа выбранного провайдера — запасной', () => {
    setEnv({ GROQ_API_KEY: 'g', ANTHROPIC_API_KEY: 'a', LLM_PROVIDER: 'groq' });
    expect(llmProvider()).toBe('groq');
    setEnv({ ANTHROPIC_API_KEY: 'a', LLM_PROVIDER: 'groq' });
    expect(llmProvider()).toBe('anthropic');
  });
});

describe('llm helpers', () => {
  it('parseJson снимает ```json``` и текст вокруг', () => {
    expect(parseJson('```json\n{"a":1}\n```')).toEqual({ ok: true, value: { a: 1 } });
    expect(parseJson('Вот ответ: {"a":2} готово')).toEqual({ ok: true, value: { a: 2 } });
    expect(parseJson('не json').ok).toBe(false);
  });
  it('nullToAnyOf заменяет type-массивы с null', () => {
    expect(nullToAnyOf({ type: ['string', 'null'] })).toEqual({ anyOf: [{ type: 'string' }, { type: 'null' }] });
    const out = JSON.stringify(nullToAnyOf(feedbackJsonSchema));
    expect(out).not.toContain('"type":["');
  });
  it('strict-схемы: у каждого объекта все поля required и additionalProperties:false', () => {
    const walk = (n: unknown) => {
      if (!n || typeof n !== 'object') return;
      const o = n as Record<string, unknown>;
      if (o.type === 'object') {
        expect(o.additionalProperties).toBe(false);
        expect([...(o.required as string[])].sort()).toEqual(Object.keys(o.properties as object).sort());
      }
      Object.values(o).forEach(walk);
    };
    walk(feedbackJsonSchema);
    walk(planJsonSchema);
  });
});

describe('sanitizePlan', () => {
  const item = (speaking: boolean, over = {}) => ({
    title: 'Пауза вместо «типа»',
    why: 'Ты сказал «типа» 9 раз',
    targets: ['fillers' as const],
    minutes: 15,
    speaking,
    take_s: speaking ? 200 : null,
    topic: speaking ? 'Расскажи про свой вчерашний день' : null,
    frame_id: 'нет-такого',
    instructions: ['Шаг 1'],
    success: '≤ 2 паразитов',
    base_exercise_id: 'нет-такого',
    ...over,
  });
  const i = { profile: { scores: [], topFillers: [], takesAnalyzed: 0 }, recentEvents: [], recentTasks: [], recentTopics: [], seed: 'x' };

  it('зажимает длительности, чистит чужие id, нумерует', () => {
    const items = sanitizePlan([item(true), item(true), item(false), item(false)], i)!;
    expect(items).toHaveLength(4);
    expect(items[0]).toMatchObject({ minutes: 10, take_s: 120, speaking: true });
    expect(items[0].frame_id).toBeUndefined();
    expect(items[0].base_exercise_id).toBeUndefined();
    expect(items[2].take_s).toBeUndefined();
    expect(new Set(items.map((x) => x.id)).size).toBe(4);
    expect(planSchema.safeParse({ items: [item(true)] }).success).toBe(true);
  });
  it('null, если меньше 4 пунктов или меньше 2 речевых', () => {
    expect(sanitizePlan([item(true), item(false), item(false)], i)).toBeNull();
    expect(sanitizePlan([item(true), item(false), item(false), item(false)], i)).toBeNull();
  });
});

describe('generatePlan без ключей', () => {
  it('отдаёт правила', async () => {
    setEnv({});
    const { generatePlan } = await import('../../src/server/ai/plan');
    const r = await generatePlan({ profile: { scores: [], topFillers: [], takesAnalyzed: 0 }, recentEvents: [], recentTasks: [], recentTopics: [], seed: 'abc' });
    expect(r.source).toBe('rules');
    expect(r.items.length).toBeGreaterThan(0);
  });
});
