// CONTRACT STUB — реализует агент domain. Сигнатуры не менять.
import type { ProblemCode, ProblemEvent, ProblemProfile, SpeechMetrics } from '../types';

/** События проблем, которые считаются кодом из метрик (fillers, pace_*, few_pauses, repetitions). created_at = now ISO. */
export function metricEvents(m: SpeechMetrics, now: string): Omit<ProblemEvent, 'take_id'>[] {
  void m; void now;
  throw new Error('TODO metricEvents');
}

/** severity 1|2|3 из ответа ИИ → 0..1 */
export function aiSeverity(s: 1 | 2 | 3): number {
  return s === 1 ? 0.35 : s === 2 ? 0.65 : 0.95;
}

/** Профиль проблем по событиям (см. SPEC §3) */
export function buildProfile(events: ProblemEvent[], selfProblems: ProblemCode[], now: Date): ProblemProfile {
  void events; void selfProblems; void now;
  throw new Error('TODO buildProfile');
}
