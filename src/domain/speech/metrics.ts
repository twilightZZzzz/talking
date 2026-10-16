import type { FillerHit, SpeechMetrics, Word } from '../types';

/** Промпт для Whisper, повышающий шанс сохранения паразитов (≤ 224 токенов) */
export const WHISPER_PROMPT = 'Э-э, ну, значит, типа... Короче, вот. Ммм, э, как бы. Эм, ну вот.';

export const PAUSE_MIN_S = 0.7;
const REP_WINDOW = 20;

const SINGLE_FILLERS = new Set(['ну', 'типа', 'короче', 'вот', 'значит', 'собственно', 'получается']);
const MULTI_FILLERS: string[][] = [
  ['как', 'бы'],
  ['так', 'сказать'],
  ['в', 'общем'],
  ['это', 'самое'],
];

const NUMERALS = new Set([
  'один', 'одного', 'два', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять',
  'оба', 'обоих', 'разных', 'разные', 'этого', 'того', 'такого', 'другого', 'других', 'любого', 'какого',
  'каких', 'нескольких', 'всех', 'этих', 'тех',
]);
const VOT_DOUBTFUL_NEXT = new Set([
  'пример', 'так', 'почему', 'зачем', 'что', 'как', 'главное', 'вывод', 'итог', 'поэтому', 'смотри', 'это',
]);

const STOP = new Set([
  'этот', 'этого', 'этом', 'этой', 'этих', 'эти', 'которые', 'который', 'которая', 'которое', 'которых',
  'потому', 'когда', 'чтобы', 'также', 'очень', 'просто', 'только', 'если', 'есть', 'было', 'была', 'были',
  'быть', 'будет', 'будут', 'можно', 'нужно', 'тоже', 'всего', 'даже', 'себя', 'свой', 'своей', 'свои',
  'после', 'через', 'более', 'между', 'такой', 'такие', 'такое', 'такая', 'вообще', 'какой', 'какая', 'какие',
  'каждый', 'может', 'могут', 'потом', 'тогда', 'сейчас', 'здесь', 'надо', 'ещё', 'еще', 'всегда', 'всё',
  'чего', 'свою', 'того', 'тому', 'тебе', 'тебя', 'меня', 'мной', 'нашей', 'нашего', 'этому',
  'будто', 'хотя', 'ведь', 'либо', 'поэтому', 'однако', 'сначала', 'пока', 'тут', 'там',
]);

/** Нижний регистр, ё→е, без пунктуации (дефис внутри слова сохраняется) */
export function normalizeWord(w: string): string {
  return w
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9-]/g, '')
    .replace(/^-+|-+$/g, '');
}

/** Заполнитель-звук («э», «эээ», «э-э», «эм», «ммм») → каноническая форма или null */
export function hesitationForm(norm: string): string | null {
  const s = norm.replace(/-/g, '');
  if (!s || !/^[эм]+$/.test(s)) return null;
  const hasE = s.includes('э');
  const hasM = s.includes('м');
  if (hasE && hasM) return 'эм';
  if (hasE) return 'э';
  return s.length >= 2 ? 'м-м' : null;
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const round2 = (x: number) => Math.round(x * 100) / 100;

/** Метрики речи по словам с таймкодами. duration_s — длительность медиа.
 *  excluded — индексы слов, которые пользователь исключил: такие паразиты остаются в списке с doubtful=true и не считаются. */
export function computeMetrics(words: Word[], duration_s: number, excluded: number[] = []): SpeechMetrics {
  const exSet = new Set(excluded);
  const toks = words.map((w) => normalizeWord(w.w));
  const spoken = words.map((_, i) => i).filter((i) => toks[i] !== '');

  const fillers: FillerHit[] = [];
  const fillerIdx = new Set<number>();
  for (let i = 0; i < words.length; i++) {
    const tk = toks[i];
    if (!tk) continue;
    let form: string | null = hesitationForm(tk);
    let span = 1;
    if (!form) {
      const multi = MULTI_FILLERS.find((m) => m.every((x, k) => toks[i + k] === x));
      if (multi) {
        form = multi.join(' ');
        span = multi.length;
      } else if (SINGLE_FILLERS.has(tk)) form = tk;
    }
    if (!form) continue;

    const prev = toks[i - 1] ?? '';
    const next = toks[i + span] ?? '';
    let doubtful = false;
    if (form === 'типа') doubtful = NUMERALS.has(prev) || /^\d+$/.test(prev);
    else if (form === 'значит') doubtful = prev === 'это' || prev === 'что' || next === 'что';
    else if (form === 'вот') doubtful = VOT_DOUBTFUL_NEXT.has(next);
    else if (form === 'короче') doubtful = next === 'чем';
    for (let k = 0; k < span; k++) if (exSet.has(i + k)) doubtful = true;

    fillers.push({ i, word: form, t: round2(words[i].start), doubtful });
    for (let k = 0; k < span; k++) fillerIdx.add(i + k);
    i += span - 1;
  }

  const word_count = spoken.length;
  const first = spoken.length ? words[spoken[0]].start : 0;
  const last = spoken.length ? words[spoken[spoken.length - 1]].end : 0;
  const speech_s = round1(Math.max(0, last - first));
  const minutes = speech_s / 60;
  const wpm = speech_s > 0 ? Math.round(word_count / minutes) : 0;
  const fillers_count = fillers.filter((f) => !f.doubtful).length;
  const fpm = speech_s > 0 ? round1(fillers_count / minutes) : 0;

  const pauses: { t: number; len: number }[] = [];
  for (let k = 1; k < spoken.length; k++) {
    const a = words[spoken[k - 1]];
    const b = words[spoken[k]];
    const gap = b.start - a.end;
    if (gap > PAUSE_MIN_S) pauses.push({ t: round2(a.end), len: round2(gap) });
  }
  const pauses_per_min = speech_s > 0 ? round1(pauses.length / minutes) : 0;

  // повторы: значимое слово ≥3 раз в окне из 20 слов
  const positions = new Map<string, number[]>();
  spoken.forEach((wi, pos) => {
    const tk = toks[wi];
    if (tk.length < 4 || STOP.has(tk) || fillerIdx.has(wi) || SINGLE_FILLERS.has(tk) || /^\d+$/.test(tk)) return;
    (positions.get(tk) ?? positions.set(tk, []).get(tk)!).push(pos);
  });
  const repetitions: SpeechMetrics['repetitions'] = [];
  for (const [word, ps] of positions) {
    let j = 0;
    while (j < ps.length) {
      let m = j;
      while (m + 1 < ps.length && ps[m + 1] - ps[j] < REP_WINDOW) m++;
      if (m - j + 1 >= 3) {
        repetitions.push({ word, count: m - j + 1, t: round2(words[spoken[ps[j]]].start) });
        j = m + 1;
      } else j++;
    }
  }
  repetitions.sort((a, b) => a.t - b.t);

  return {
    duration_s: round1(duration_s),
    speech_s,
    word_count,
    wpm,
    fillers,
    fillers_count,
    fpm,
    pauses,
    pauses_per_min,
    repetitions,
  };
}
