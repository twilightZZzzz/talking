import Groq, { toFile } from 'groq-sdk';
import { WHISPER_PROMPT } from '../../domain/speech/metrics';
import type { Word } from '../../domain/types';
import { GROQ_ASR_MODEL } from './config';
import { AiError, httpStatusOf, isTransient } from './errors';
import { mockTranscript } from './mock';

export interface TranscribeInput {
  audio: Blob | Buffer;
  filename: string;
  mime: string;
  duration_s: number;
}
export interface TranscribeResult {
  text: string;
  words: Word[];
  model: string;
}

export const MOCK_ASR_MODEL = 'mock';
const TIMEOUT_MS = 120_000;

interface VerboseSegment {
  no_speech_prob?: number;
}
interface VerboseResponse {
  text?: string;
  words?: { word?: string; start?: number; end?: number }[];
  segments?: VerboseSegment[];
}

export async function transcribe(input: TranscribeInput): Promise<TranscribeResult> {
  if (!process.env.GROQ_API_KEY?.trim()) {
    const m = mockTranscript(input.duration_s);
    return { text: m.text, words: m.words, model: MOCK_ASR_MODEL };
  }
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: TIMEOUT_MS, maxRetries: 0 });
  const started = Date.now();
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const bytes = input.audio instanceof Blob ? await input.audio.arrayBuffer() : input.audio;
      const file = await toFile(bytes, input.filename, { type: input.mime });
      const res = (await groq.audio.transcriptions.create({
        file,
        model: GROQ_ASR_MODEL,
        language: 'ru',
        response_format: 'verbose_json',
        timestamp_granularities: ['word', 'segment'],
        prompt: WHISPER_PROMPT,
        temperature: 0,
      })) as unknown as VerboseResponse;
      return parseVerbose(res);
    } catch (e) {
      lastErr = e;
      if (attempt === 0 && isTransient(e) && Date.now() - started < 60_000) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      break;
    }
  }
  throw asrError(lastErr);
}

export function parseVerbose(res: VerboseResponse): TranscribeResult {
  const words: Word[] = (res.words ?? [])
    .filter((w) => typeof w.word === 'string' && w.word.trim() && Number.isFinite(w.start) && Number.isFinite(w.end))
    .map((w) => ({ w: w.word!.trim(), start: w.start as number, end: w.end as number }));
  const segs = res.segments ?? [];
  const allSilent = segs.length > 0 && segs.every((s) => (s.no_speech_prob ?? 0) > 0.8);
  if (allSilent || !words.length) return { text: '', words: [], model: GROQ_ASR_MODEL };
  return { text: (res.text ?? words.map((w) => w.w).join(' ')).trim(), words, model: GROQ_ASR_MODEL };
}

function asrError(e: unknown): AiError {
  const s = httpStatusOf(e);
  if (s === 429) return new AiError('Сервис распознавания речи перегружен. Попробуй через минуту.', true, e);
  if (s === 401 || s === 403) return new AiError('Ключ сервиса распознавания речи не принят. Сообщи владельцу.', false, e);
  if (s === 400 || s === 413 || s === 422) {
    return new AiError('Не удалось прочитать звук этого дубля. Запиши дубль ещё раз прямо в приложении.', false, e);
  }
  if (isTransient(e)) return new AiError('Распознавание речи не отвечает. Попробуй ещё раз через минуту.', true, e);
  return new AiError('Не удалось распознать речь. Попробуй ещё раз.', true, e);
}
