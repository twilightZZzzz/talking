import type { Challenge, Frame, SpeechMetrics, Word } from '../../src/domain/types';
import type { AnalyzeFeedbackInput } from '../../src/server/ai/feedback';
import { mockTranscript } from '../../src/server/ai/mock';

export const FRAME: Frame = {
  id: 'f1',
  name: 'Проблема — решение — итог',
  points: [
    { id: 'p1', mark: '1', text: 'Назови проблему' },
    { id: 'p2', mark: '2', text: 'Предложи решение' },
    { id: 'p3', mark: '3', text: 'Подведи итог' },
  ],
};

export const CHALLENGE: Challenge = { id: 'c1', title: 'Начни с вопроса', hint: 'Первая фраза — вопрос', targets: ['slow_start'], assessable: true };

/** Упрощённые метрики для тестов (настоящий computeMetrics пишет другой агент) */
export function fakeMetrics(words: Word[], duration_s: number): SpeechMetrics {
  const fillerSet = new Set(['э-э', 'ну', 'типа', 'короче', 'эм']);
  const fillers = words
    .map((w, i) => ({ i, word: w.w.toLowerCase().replace(/[^а-яё-]/g, ''), t: w.start, doubtful: false }))
    .filter((f) => fillerSet.has(f.word));
  const span = words.length ? words[words.length - 1].end - words[0].start : 0;
  const pauses = words.slice(1).flatMap((w, k) => (w.start - words[k].end > 0.7 ? [{ t: words[k].end, len: w.start - words[k].end }] : []));
  return {
    duration_s,
    speech_s: span,
    word_count: words.length,
    wpm: span ? (words.length / span) * 60 : 0,
    fillers,
    fillers_count: fillers.length,
    fpm: span ? (fillers.length / span) * 60 : 0,
    pauses,
    pauses_per_min: span ? (pauses.length / span) * 60 : 0,
    repetitions: [],
  };
}

export function input(duration_s = 75, extra: Partial<AnalyzeFeedbackInput> = {}): AnalyzeFeedbackInput {
  const t = mockTranscript(duration_s);
  return {
    take: { id: 't1', duration_s },
    metrics: fakeMetrics(t.words, duration_s),
    words: t.words,
    transcript: t.text,
    frame: FRAME,
    challenge: CHALLENGE,
    topic: 'Как я планирую неделю',
    previous: { fpm: 9, wpm: 140, next_task: 'Скажи вывод первой фразой' },
    chronic: [{ code: 'fillers', title: 'Слова-паразиты', short: 'э, ну, типа', score: 60, example: 'ну вот' }],
    ...extra,
  };
}
