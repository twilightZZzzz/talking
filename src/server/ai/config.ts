import type { AiStatus } from '../../domain/types';

export type LlmProvider = AiStatus['llm'];

export const ANTHROPIC_MODEL = 'claude-sonnet-5-5';
export const GROQ_LLM_MODEL = 'openai/gpt-oss-120b';
export const GROQ_ASR_MODEL = 'whisper-large-v3';

const has = (k: string) => !!process.env[k]?.trim();

export function llmProvider(): LlmProvider {
  const want = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if (want === 'anthropic' && has('ANTHROPIC_API_KEY')) return 'anthropic';
  if (want === 'groq' && has('GROQ_API_KEY')) return 'groq';
  if (has('ANTHROPIC_API_KEY') && want !== 'groq') return 'anthropic';
  if (has('GROQ_API_KEY')) return 'groq';
  if (has('ANTHROPIC_API_KEY')) return 'anthropic';
  return 'mock';
}

export function aiStatus(): AiStatus {
  return { transcription: has('GROQ_API_KEY') ? 'groq' : 'mock', llm: llmProvider() };
}
