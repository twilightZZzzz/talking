import type { Feedback, ProblemCode } from '../../domain/types';
import type { AnalyzeFeedbackInput } from './feedback';
import { clipWords, locateQuote, normalizeText, splitSentences } from './text';

const MIN_FOR_PRAISE = 20;
export const SHORT_ISSUE = 'Слишком короткая запись для разбора';

const TASKS: Partial<Record<ProblemCode, string>> = {
  fillers: 'Поставь паузу вместо «э»: замолчи, пока не придёт следующее слово. Цель — не больше 2 паразитов за дубль.',
  pace_fast: 'Говори вдвое медленнее: после каждого предложения считай про себя «раз-два». Цель — 120–150 слов в минуту.',
  pace_slow: 'Ускорься: проговори мысль на 20% быстрее, не растягивая слова. Цель — 120–150 слов в минуту.',
  few_pauses: 'Ставь паузу в 1 секунду после каждой завершённой мысли. Цель — минимум 3 паузы за дубль.',
  repetitions: 'Не повторяй одно слово чаще двух раз подряд: подбери синоним или перестрой фразу.',
  slow_start: 'Скажи вывод первой фразой, до 12 слов, без вводных вроде «ну, значит».',
  detours: 'Держись каркаса: уходя в сторону, скажи «вернусь к теме» и сразу произнеси следующий пункт.',
  frame_gaps: 'Проговори все пункты каркаса по порядку, на каждый — минимум одно предложение.',
  frame_order: 'Назови пункты каркаса вслух в начале («сначала…, потом…, в конце…») и иди строго по этому порядку.',
  run_on: 'Заканчивай каждую мысль точкой: предложение не длиннее 15 слов, потом пауза.',
  weak_ending: 'Закончи дубль выводом одним предложением: «Итого: …». Потом замолчи.',
  vague: 'Добавь в дубль один конкретный пример с цифрой или названием.',
};

export function taskFor(code?: ProblemCode): string {
  return (code && TASKS[code]) || 'Запиши ещё один дубль на ту же тему и начни с вывода первой фразой.';
}

const STARTS_FILLER = /^(ну|э+|эм+|вот|короче|так|значит|я хотел|я хочу|сегодня я|итак)(\s|$)/;
const DETOUR_MARK = /(кстати|к слову|а ещё|отвлекусь|помню,? как|вообще-то)/i;
const CONCLUSION_MARK = /(итог|вывод|в общем|поэтому|главное|советую|значит,? что)/i;

export function shortFeedback(i: AnalyzeFeedbackInput): Feedback {
  return {
    clarity: null,
    clarity_reason: 'Слишком мало слов, чтобы оценить ясность.',
    opening: { is_conclusion: null, quote: '', comment: '' },
    frame: (i.frame?.points ?? []).map((p) => ({ point_id: p.id, point: p.text, present: false, quote: '', comment: '' })),
    frame_order_ok: null,
    detours: [],
    challenge: { done: null, comment: 'Запись слишком короткая, чтобы это проверить.' },
    vs_previous: null,
    issues: [],
    strengths: [],
    main_issue: SHORT_ISSUE,
    next_task: 'Запиши дубль подлиннее — хотя бы 45 секунд речи.',
    rewrite_opening: '',
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Эвристический разбор без ИИ: метрики + ключевые слова. Нужен, чтобы весь UX работал без ключей. */
export function mockFeedback(i: AnalyzeFeedbackInput): Feedback {
  const { metrics: m, words } = i;
  const sentences = splitSentences(i.transcript);
  const first = sentences[0] ?? '';
  const firstClip = clipWords(first, 12);
  const asksQuestion = !!i.challenge && /вопрос/i.test(i.challenge.title + ' ' + i.challenge.hint);
  const isConclusion = asksQuestion ? first.includes('?') : !STARTS_FILLER.test(normalizeText(first));

  const sentNorm = sentences.map(normalizeText);
  const framePts = (i.frame?.points ?? []).map((p) => {
    const stems = normalizeText(p.text)
      .split(' ')
      .filter((w) => w.length >= 5)
      .map((w) => w.slice(0, Math.max(4, w.length - 2)));
    const idx = stems.length ? sentNorm.findIndex((s) => stems.some((st) => new RegExp(`(^| )${st}`).test(s))) : -1;
    return {
      point_id: p.id,
      point: p.text,
      present: idx >= 0,
      quote: idx >= 0 ? clipWords(sentences[idx], 12) : '',
      comment: idx >= 0 ? '' : 'Этот пункт в речи не прозвучал.',
      idx,
    };
  });
  const presentPts = framePts.filter((f) => f.present);
  const orderOk = presentPts.length >= 2 ? presentPts.every((f, k) => k === 0 || f.idx >= presentPts[k - 1].idx) : null;
  const gaps = framePts.length - presentPts.length;

  const detours: Feedback['detours'] = [];
  sentences.forEach((s, k) => {
    if (k > 0 && detours.length < 2 && DETOUR_MARK.test(s)) {
      const quote = clipWords(s, 12);
      detours.push({ t: locateQuote(words, quote) ?? 0, quote, comment: 'Здесь мысль свернула в сторону от основной линии.' });
    }
  });

  const lastSentence = sentences[sentences.length - 1] ?? '';
  const weakEnding = sentences.length > 2 && !CONCLUSION_MARK.test(lastSentence);
  const longest = sentences.reduce((a, s) => (s.split(/\s+/).length > a.split(/\s+/).length ? s : a), '');
  const runOn = longest.split(/\s+/).length > 25;
  const vague = !/\d/.test(i.transcript) && !/например|к примеру/i.test(i.transcript);

  const issues: Feedback['issues'] = [];
  if (!isConclusion && first) {
    issues.push({ code: 'slow_start', severity: 2, quote: firstClip, comment: 'Начало — разгон, вывод прозвучал позже.' });
  }
  if (detours.length) issues.push({ code: 'detours', severity: detours.length > 1 ? 2 : 1, quote: detours[0].quote, comment: 'Была отсылка в сторону от темы.' });
  if (gaps > 0) issues.push({ code: 'frame_gaps', severity: gaps / framePts.length > 0.5 ? 3 : 2, quote: '', comment: `Не прозвучало пунктов каркаса: ${gaps} из ${framePts.length}.` });
  if (orderOk === false) issues.push({ code: 'frame_order', severity: 2, quote: '', comment: 'Пункты каркаса прозвучали не в заданном порядке.' });
  if (runOn) issues.push({ code: 'run_on', severity: 2, quote: clipWords(longest, 12), comment: 'Предложение тянется цепочкой, мысль теряет границы.' });
  if (weakEnding) issues.push({ code: 'weak_ending', severity: 2, quote: clipWords(lastSentence, 12), comment: 'Конец без итога: речь просто закончилась.' });
  if (vague) issues.push({ code: 'vague', severity: 1, quote: '', comment: 'Нет ни одного примера, цифры или факта.' });

  const strengths: string[] = [];
  if (isConclusion && firstClip) strengths.push(`Первая фраза «${firstClip}» сразу к делу.`);
  if (m.wpm >= 120 && m.wpm <= 150) strengths.push(`Темп ${Math.round(m.wpm)} слов в минуту — в целевой зоне 120–150.`);
  if (m.pauses_per_min >= 3) strengths.push(`Ты ставишь паузы: ${r1(m.pauses_per_min)} в минуту — это то, что нужно вместо «э».`);
  if (m.fpm <= 2 && m.word_count >= MIN_FOR_PRAISE) strengths.push(`Мало паразитов: ${r1(m.fpm)} в минуту.`);
  if (framePts.length && gaps === 0) strengths.push('Все пункты каркаса прозвучали.');
  if (!strengths.length) strengths.push('Ты довёл дубль до конца — тренировка засчитана, теперь работаем над качеством.');

  const topFiller = (() => {
    const c = new Map<string, number>();
    m.fillers.filter((f) => !f.doubtful).forEach((f) => c.set(f.word, (c.get(f.word) ?? 0) + 1));
    return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  })();
  const topIssue = issues.slice().sort((a, b) => b.severity - a.severity)[0];
  const chronicHit = i.chronic.find((c) => issues.some((x) => x.code === c.code));
  const focus: ProblemCode | undefined = m.fpm > 5 ? 'fillers' : (chronicHit?.code ?? topIssue?.code ?? i.chronic[0]?.code);

  let main_issue: string;
  if (m.fpm > 5) {
    main_issue = `Слова-паразиты: ${m.fillers_count} за ${r1(m.duration_s / 60)} мин (${r1(m.fpm)} в минуту)${topFiller ? `, чаще всего «${topFiller}»` : ''}.`;
  } else if (topIssue) {
    main_issue = topIssue.comment;
  } else {
    main_issue = 'Серьёзных проблем в этом дубле не видно — закрепляй результат.';
  }

  let challengeDone: boolean | null = null;
  let challengeComment = i.challenge ? 'По записи это не проверить.' : '';
  if (i.challenge?.assessable) {
    const t = i.challenge.targets;
    if (t.includes('fillers')) challengeDone = m.fpm <= 3;
    else if (t.includes('slow_start')) challengeDone = isConclusion;
    else if (t.includes('few_pauses')) challengeDone = m.pauses_per_min >= 2;
    else if (t.includes('pace_fast') || t.includes('pace_slow')) challengeDone = m.wpm >= 120 && m.wpm <= 150;
    if (challengeDone !== null) {
      challengeComment = challengeDone ? 'По метрикам записи челлендж выполнен.' : 'По метрикам записи челлендж не выполнен.';
    }
  }

  let clarity = 5;
  if (m.fpm > 6) clarity--;
  if (!isConclusion) clarity--;
  if (framePts.length && presentPts.length / framePts.length < 0.5) clarity--;
  if (detours.length) clarity--;
  clarity = Math.max(1, clarity);

  let vs_previous: string | null = null;
  if (i.previous?.fpm != null) {
    const d = r1(m.fpm - i.previous.fpm);
    vs_previous = `Паразитов в минуту: было ${r1(i.previous.fpm)}, стало ${r1(m.fpm)} — ${d < -0.2 ? 'лучше' : d > 0.2 ? 'хуже' : 'без изменений'}.`;
  }

  const topic = i.topic?.trim();
  return {
    clarity,
    clarity_reason: isConclusion
      ? 'Мысль понятна с первых секунд, дальше важно удержать порядок.'
      : 'Первые секунды ушли на разгон, главная мысль проявилась не сразу.',
    opening: {
      is_conclusion: isConclusion,
      quote: firstClip,
      comment: isConclusion ? 'Начало сразу по делу.' : 'Начало — разгон с вводными словами, вывод прозвучал позже.',
    },
    frame: framePts.map((f) => ({ point_id: f.point_id, point: f.point, present: f.present, quote: f.quote, comment: f.comment })),
    frame_order_ok: orderOk,
    detours,
    challenge: { done: challengeDone, comment: challengeComment },
    vs_previous,
    issues: issues.slice(0, 5),
    strengths: strengths.slice(0, 3),
    main_issue,
    next_task: taskFor(focus),
    rewrite_opening: topic
      ? `Если коротко, то вот мой вывод по теме «${topic}», а дальше объясню почему.`
      : 'Если коротко, то вот мой главный вывод, а дальше объясню почему.',
  };
}
