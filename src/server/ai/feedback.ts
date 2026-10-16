import { z } from 'zod';
import { aiSeverity } from '../../domain/problems/events';
import type { Challenge, Feedback, Frame, ProblemCode, SpeechMetrics, Take, Word } from '../../domain/types';
import { generateJson, type JsonSchema } from './llm';
import { llmProvider } from './config';
import { mockFeedback, shortFeedback, SHORT_ISSUE, taskFor } from './mock-feedback';
import { loadPrompt } from './prompts';
import { clipWords, normalizeText, quoteInTranscript } from './text';

export const PROMPT_VERSION = 'feedback-v2';
export const MIN_WORDS = 20;
export const AI_CODES = ['slow_start', 'detours', 'frame_gaps', 'frame_order', 'run_on', 'weak_ending', 'vague'] as const;
type AiCode = (typeof AI_CODES)[number];

export interface ChronicProblem {
  code: ProblemCode;
  title: string;
  short: string;
  score: number;
  example?: string;
}
export interface PreviousTake {
  fpm: number | null;
  wpm: number | null;
  next_task: string | null;
}
export interface AnalyzeFeedbackInput {
  take: Pick<Take, 'id' | 'duration_s'>;
  metrics: SpeechMetrics;
  words: Word[];
  transcript: string;
  frame?: Frame;
  challenge?: Challenge;
  topic: string | null;
  previous: PreviousTake | null;
  chronic: ChronicProblem[];
}
export interface AnalyzeFeedbackResult {
  feedback: Feedback;
  model: string;
  prompt_version: string;
}

export const feedbackSchema = z.object({
  clarity: z.number().nullable(),
  clarity_reason: z.string(),
  opening: z.object({ is_conclusion: z.boolean().nullable(), quote: z.string(), comment: z.string() }),
  frame: z.array(
    z.object({ point_id: z.string(), point: z.string(), present: z.boolean(), quote: z.string(), comment: z.string() }),
  ),
  frame_order_ok: z.boolean().nullable(),
  detours: z.array(z.object({ t: z.number(), quote: z.string(), comment: z.string() })),
  challenge: z.object({ done: z.boolean().nullable(), comment: z.string() }),
  vs_previous: z.string().nullable(),
  issues: z.array(
    z.object({
      code: z.enum(AI_CODES),
      severity: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      quote: z.string(),
      comment: z.string(),
    }),
  ),
  strengths: z.array(z.string()),
  main_issue: z.string(),
  next_task: z.string(),
  rewrite_opening: z.string(),
});

const str = { type: 'string' };
const obj = (properties: Record<string, unknown>) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

export const feedbackJsonSchema: JsonSchema = obj({
  clarity: { type: ['integer', 'null'] },
  clarity_reason: str,
  opening: obj({ is_conclusion: { type: ['boolean', 'null'] }, quote: str, comment: str }),
  frame: {
    type: 'array',
    items: obj({ point_id: str, point: str, present: { type: 'boolean' }, quote: str, comment: str }),
  },
  frame_order_ok: { type: ['boolean', 'null'] },
  detours: { type: 'array', items: obj({ t: { type: 'number' }, quote: str, comment: str }) },
  challenge: obj({ done: { type: ['boolean', 'null'] }, comment: str }),
  vs_previous: { type: ['string', 'null'] },
  issues: {
    type: 'array',
    items: obj({ code: { type: 'string', enum: [...AI_CODES] }, severity: { type: 'integer', enum: [1, 2, 3] }, quote: str, comment: str }),
  },
  strengths: { type: 'array', items: str },
  main_issue: str,
  next_task: str,
  rewrite_opening: str,
});

export async function analyzeFeedback(input: AnalyzeFeedbackInput): Promise<AnalyzeFeedbackResult> {
  if (input.metrics.word_count < MIN_WORDS) {
    return { feedback: shortFeedback(input), model: 'none', prompt_version: PROMPT_VERSION };
  }
  if (llmProvider() === 'mock') {
    return { feedback: sanitizeFeedback(mockFeedback(input), input), model: 'mock', prompt_version: PROMPT_VERSION };
  }
  const { data, model } = await generateJson({
    system: loadPrompt('feedback.md'),
    user: buildUserMessage(input),
    schema: feedbackSchema,
    jsonSchema: feedbackJsonSchema,
    maxTokens: 4000,
    name: 'feedback',
  });
  return { feedback: sanitizeFeedback(data, input), model, prompt_version: PROMPT_VERSION };
}

const clean = (s: string) => s.replace(/[<>]/g, '').trim();

export function buildUserMessage(i: AnalyzeFeedbackInput): string {
  const { metrics: m } = i;
  const lines: string[] = [];
  let row: string[] = [];
  let rowT = 0;
  i.words.forEach((w, idx) => {
    if (!row.length) rowT = w.start;
    row.push(`${idx}:${clean(w.w)}`);
    if (row.length >= 12) {
      lines.push(`t=${rowT.toFixed(1)} ${row.join(' ')}`);
      row = [];
    }
  });
  if (row.length) lines.push(`t=${rowT.toFixed(1)} ${row.join(' ')}`);

  const parts: string[] = [];
  parts.push(`<topic>${clean(i.topic ?? '')}</topic>`);
  parts.push(
    i.frame
      ? `<frame name="${clean(i.frame.name)}">\n${i.frame.points.map((p) => `${p.id} | ${clean(p.mark)} ${clean(p.text)}`).join('\n')}\n</frame>`
      : '<frame></frame>',
  );
  parts.push(
    i.challenge
      ? `<challenge assessable="${i.challenge.assessable}">${clean(i.challenge.title)} — ${clean(i.challenge.hint)}</challenge>`
      : '<challenge></challenge>',
  );
  parts.push(
    `<metrics>\n${JSON.stringify({
      duration_s: round1(m.duration_s),
      words: m.word_count,
      wpm: Math.round(m.wpm),
      fillers_total: m.fillers_count,
      fillers_per_min: round1(m.fpm),
      fillers: m.fillers.filter((f) => !f.doubtful).slice(0, 30).map((f) => ({ word: f.word, t: round1(f.t) })),
      pauses_over_0_7s: m.pauses.length,
      pauses_per_min: round1(m.pauses_per_min),
      repetitions: m.repetitions.slice(0, 5),
    })}\n</metrics>`,
  );
  parts.push(
    i.previous
      ? `<previous>\n${JSON.stringify({ fillers_per_min: i.previous.fpm, wpm: i.previous.wpm, next_task: i.previous.next_task })}\n</previous>`
      : '<previous></previous>',
  );
  if (i.chronic.length) {
    parts.push(
      `<chronic>\n${i.chronic
        .map((c) => `${c.code} | выраженность ${Math.round(c.score)}/100 | ${c.title}: ${c.short}${c.example ? ` | его цитата: «${clean(c.example)}»` : ''}`)
        .join('\n')}\n</chronic>`,
    );
  }
  parts.push(`<transcript>\n${lines.join('\n')}\n</transcript>`);
  return parts.join('\n\n');
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const cut = (s: string, n = 400) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s).trim();

/** Пост-валидация: цитаты только из транскрипта, структура и ограничения по правилам промпта */
const CODE_RE = /\s*\(?\b(fillers|pace_fast|pace_slow|few_pauses|slow_start|detours|frame_gaps|frame_order|run_on|weak_ending|vague|repetitions)\b\)?/g;
/** Модель иногда вставляет коды проблем в текст для человека — вычищаем */
const stripCodes = (t: string) => t.replace(CODE_RE, '').replace(/\s{2,}/g, ' ').trim();

export function sanitizeFeedback(fb: Feedback, i: AnalyzeFeedbackInput): Feedback {
  fb = {
    ...fb,
    main_issue: stripCodes(fb.main_issue),
    next_task: stripCodes(fb.next_task),
    clarity_reason: stripCodes(fb.clarity_reason),
    vs_previous: fb.vs_previous ? stripCodes(fb.vs_previous) : fb.vs_previous,
  };
  const tn = normalizeText(i.transcript);
  const q = (s: string) => (quoteInTranscript(s, tn) ? clipWords(s.trim(), 14) : '');
  const short = i.metrics.word_count < MIN_WORDS;
  const dur = i.take.duration_s ?? i.metrics.duration_s;

  const firstSentence = clipWords(i.transcript.split(/(?<=[.!?…])\s+/)[0] ?? '', 12);
  const openingQuote = q(fb.opening.quote) || (quoteInTranscript(firstSentence, tn) ? firstSentence : '');

  const byId = new Map(fb.frame.map((f) => [f.point_id, f]));
  const frame = (i.frame?.points ?? []).map((p) => {
    const f = byId.get(p.id);
    const quote = f ? q(f.quote) : '';
    return {
      point_id: p.id,
      point: p.text,
      present: !!f?.present,
      quote: f?.present ? quote : '',
      comment: cut(f?.comment ?? ''),
    };
  });
  const presentCount = frame.filter((f) => f.present).length;

  const seen = new Map<AiCode, Feedback['issues'][number]>();
  for (const it of fb.issues) {
    if (!(AI_CODES as readonly string[]).includes(it.code)) continue;
    // без каркаса нечего «пропускать» и нечего путать по порядку
    if (!i.frame && (it.code === 'frame_gaps' || it.code === 'frame_order')) continue;
    const prev = seen.get(it.code as AiCode);
    if (!prev || it.severity > prev.severity) {
      seen.set(it.code as AiCode, { code: it.code, severity: it.severity, quote: q(it.quote), comment: cut(it.comment) });
    }
  }
  const issues = short ? [] : [...seen.values()].sort((a, b) => b.severity - a.severity).slice(0, 5);

  const strengths = fb.strengths
    .filter((s) => {
      const quoted = [...s.matchAll(/[«"“]([^»"”]{2,})[»"”]/g)].map((m) => m[1]);
      return quoted.every((x) => quoteInTranscript(x, tn));
    })
    .map((s) => cut(s))
    .slice(0, 3);

  const assessable = !!i.challenge && i.challenge.assessable;
  const clarity = short || fb.clarity === null ? null : Math.min(5, Math.max(1, Math.round(fb.clarity)));

  let main_issue = cut(fb.main_issue);
  if (short) main_issue = SHORT_ISSUE;
  if (!main_issue) main_issue = issues[0]?.comment || 'Явной главной проблемы в этом дубле не видно.';
  const top = issues[0]?.code ?? i.chronic[0]?.code;

  return {
    clarity,
    clarity_reason: cut(fb.clarity_reason),
    opening: { is_conclusion: short ? null : fb.opening.is_conclusion, quote: openingQuote, comment: cut(fb.opening.comment) },
    frame,
    frame_order_ok: frame.length && presentCount >= 2 ? fb.frame_order_ok : null,
    detours: fb.detours
      .map((d) => ({ t: Math.min(Math.max(0, d.t), dur || d.t), quote: q(d.quote), comment: cut(d.comment) }))
      .sort((a, b) => a.t - b.t)
      .slice(0, 5),
    challenge: {
      done: assessable ? fb.challenge.done : null,
      comment: cut(fb.challenge.comment || (i.challenge && !assessable ? 'По записи это не проверить.' : '')),
    },
    vs_previous: i.previous ? (fb.vs_previous ? cut(fb.vs_previous) : null) : null,
    issues,
    strengths,
    main_issue,
    next_task: cut(fb.next_task) || taskFor(top),
    rewrite_opening: cut(fb.rewrite_opening),
  };
}

/** События ИИ для problem_events (без created_at/take_id) */
export function aiEvents(fb: Feedback, locate: (quote: string) => number | undefined) {
  const out = new Map<ProblemCode, { code: ProblemCode; severity: number; evidence: { quote?: string; t?: number; value?: number } }>();
  for (const it of fb.issues) {
    const t = it.quote ? locate(it.quote) : undefined;
    out.set(it.code, {
      code: it.code,
      severity: aiSeverity(it.severity),
      evidence: { ...(it.quote ? { quote: it.quote } : {}), ...(t !== undefined ? { t } : {}) },
    });
  }
  if (fb.detours.length && !out.has('detours')) {
    out.set('detours', {
      code: 'detours',
      severity: Math.min(1, fb.detours.length / 3),
      evidence: { quote: fb.detours[0].quote || undefined, t: fb.detours[0].t, value: fb.detours.length },
    });
  }
  const missing = fb.frame.filter((f) => !f.present).length;
  if (fb.frame.length && missing && !out.has('frame_gaps')) {
    out.set('frame_gaps', { code: 'frame_gaps', severity: missing / fb.frame.length, evidence: { value: missing } });
  }
  if (fb.frame_order_ok === false && !out.has('frame_order')) {
    out.set('frame_order', { code: 'frame_order', severity: aiSeverity(2), evidence: {} });
  }
  return [...out.values()];
}
