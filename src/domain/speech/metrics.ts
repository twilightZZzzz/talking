// CONTRACT STUB — реализует агент domain. Сигнатуры не менять.
import type { SpeechMetrics, Word } from '../types';

/** Метрики речи по словам с таймкодами. duration_s — длительность медиа. */
export function computeMetrics(words: Word[], duration_s: number, excluded: number[] = []): SpeechMetrics {
  void words; void duration_s; void excluded;
  throw new Error('TODO computeMetrics');
}

/** Промпт для Whisper, повышающий шанс сохранения паразитов (≤ 224 токенов) */
export const WHISPER_PROMPT = 'Э-э, ну, значит, типа... Короче, вот. Ммм, э, как бы. Эм, ну вот.';
