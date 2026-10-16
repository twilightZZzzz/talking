import Anthropic from '@anthropic-ai/sdk';
import Groq from 'groq-sdk';
import { z } from 'zod';
import { ANTHROPIC_MODEL, GROQ_LLM_MODEL, llmProvider } from './config';
import { AiError, httpStatusOf, isTransient } from './errors';

export type JsonSchema = Record<string, unknown>;

export interface GenerateJsonInput<T> {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  /** JSON Schema для structured outputs (strict-совместимый: все поля required, additionalProperties:false, null через type-массив) */
  jsonSchema?: JsonSchema;
  maxTokens: number;
  name?: string;
}

const TIMEOUT_MS = 100_000;

export async function generateJson<T>(input: GenerateJsonInput<T>): Promise<{ data: T; model: string }> {
  const provider = llmProvider();
  if (provider === 'mock') throw new AiError('ИИ-провайдер не настроен.', false);
  const jsonSchema = input.jsonSchema ?? (z.toJSONSchema(input.schema) as JsonSchema);
  const call = provider === 'anthropic' ? callAnthropic : callGroq;
  const model = provider === 'anthropic' ? ANTHROPIC_MODEL : GROQ_LLM_MODEL;

  let user = input.user;
  let lastIssue = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await callWithRetry(() => call(input.system, user, jsonSchema, input.maxTokens, input.name ?? 'result'));
    const parsed = parseJson(raw);
    if (parsed.ok) {
      const v = input.schema.safeParse(parsed.value);
      if (v.success) return { data: v.data, model };
      lastIssue = v.error.issues
        .slice(0, 6)
        .map((i) => `${i.path.join('.') || '(корень)'}: ${i.message}`)
        .join('; ');
    } else {
      lastIssue = 'ответ не является валидным JSON';
    }
    user = `${input.user}\n\nПредыдущий ответ не прошёл проверку (${lastIssue}). Верни исправленный JSON строго по схеме, без текста вокруг.`;
  }
  throw new AiError('ИИ вернул ответ в неверном формате. Попробуй ещё раз.', true, lastIssue);
}

async function callWithRetry(fn: () => Promise<string>): Promise<string> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (isTransient(e)) {
      await new Promise((r) => setTimeout(r, 1500));
      try {
        return await fn();
      } catch (e2) {
        throw llmError(e2);
      }
    }
    throw llmError(e);
  }
}

function llmError(e: unknown): AiError {
  if (e instanceof AiError) return e;
  const s = httpStatusOf(e);
  if (s === 401 || s === 403) return new AiError('Ключ ИИ-сервиса не принят. Сообщи владельцу.', false, e);
  if (s === 429) return new AiError('ИИ-сервис перегружен. Попробуй через минуту.', true, e);
  if (s === 400) return new AiError('ИИ-сервис отклонил запрос. Попробуй ещё раз.', true, e);
  return new AiError('ИИ-сервис не отвечает. Попробуй ещё раз через минуту.', true, e);
}

async function callAnthropic(system: string, user: string, schema: JsonSchema, maxTokens: number): Promise<string> {
  const client = new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 0 });
  const res = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
    output_config: { effort: 'low', format: { type: 'json_schema', schema: nullToAnyOf(schema) as JsonSchema } },
  });
  if (res.stop_reason === 'refusal') throw new AiError('ИИ отказался разбирать эту запись.', false);
  if (res.stop_reason === 'max_tokens') throw new AiError('Ответ ИИ оказался слишком длинным и оборвался. Попробуй ещё раз.', true);
  return res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
}

async function callGroq(system: string, user: string, schema: JsonSchema, maxTokens: number, name: string): Promise<string> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: TIMEOUT_MS, maxRetries: 0 });
  const base = {
    model: GROQ_LLM_MODEL,
    max_completion_tokens: maxTokens,
    temperature: 0.3,
    reasoning_effort: 'low' as const,
  };
  try {
    const res = await groq.chat.completions.create({
      ...base,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } },
    });
    return res.choices[0]?.message?.content ?? '';
  } catch (e) {
    if (httpStatusOf(e) !== 400) throw e;
    const res = await groq.chat.completions.create({
      ...base,
      messages: [
        { role: 'system', content: `${system}\n\nОтветь одним JSON-объектом по этой JSON Schema:\n${JSON.stringify(schema)}` },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
    });
    return res.choices[0]?.message?.content ?? '';
  }
}

export function parseJson(raw: string): { ok: true; value: unknown } | { ok: false } {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    const a = text.indexOf('{');
    const b = text.lastIndexOf('}');
    if (a >= 0 && b > a) {
      try {
        return { ok: true, value: JSON.parse(text.slice(a, b + 1)) };
      } catch {
        /* ниже */
      }
    }
    return { ok: false };
  }
}

/** type: ['string','null'] → anyOf (так надёжнее для structured outputs Anthropic) */
export function nullToAnyOf(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(nullToAnyOf);
  if (!node || typeof node !== 'object') return node;
  const obj = node as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = nullToAnyOf(v);
  const t = out.type;
  if (Array.isArray(t) && t.includes('null') && t.length === 2) {
    const other = t.find((x) => x !== 'null');
    const { type: _type, ...rest } = out;
    void _type;
    return { anyOf: [{ ...rest, type: other }, { type: 'null' }] };
  }
  return out;
}
