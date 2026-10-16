import type { Word } from '../../domain/types';

/** Детерминированный ГПСЧ */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SENTENCES: string[] = [
  'Ну, вот, э-э, сегодня я хочу рассказать про то, как я планирую свою неделю.',
  'Короче, главная идея в том, что без плана день растекается.',
  'Я, типа, раньше записывал всё в голове, и это, э-э, не работало.',
  'Поэтому сейчас я каждое утро беру лист и пишу три задачи.',
  'Вот, например, вчера я написал: закончить отчёт, позвонить клиенту и пойти в зал.',
  'Э-э, и знаешь, три задачи — это реально выполнимо, а десять — нет.',
  'Ну, как бы, самое сложное — это выбрать, что действительно важно.',
  'Я задаю себе один вопрос: что будет, если я это не сделаю?',
  'Если ничего не случится, то задача уходит на завтра.',
  'Типа, так получается меньше суеты и больше спокойствия.',
  'Ещё я заметил, что утром голова работает лучше, чем вечером.',
  'Поэтому самую трудную задачу я ставлю первой, пока нет отвлекающих сообщений.',
  'Короче, э-э, в итоге я стал успевать больше и меньше нервничать.',
  'Вот, значит, мой вывод: план из трёх задач работает лучше любого большого списка.',
  'Ну и, в общем, я советую попробовать это хотя бы одну неделю.',
];

const FILLER_ONLY = ['э-э', 'ну', 'эм', 'типа', 'вот'];

export interface MockTranscript {
  text: string;
  words: Word[];
}

/** Правдоподобный русский транскрипт, растянутый на duration_s (~2 слова/с с паузами). Детерминирован. */
export function mockTranscript(duration_s: number): MockTranscript {
  const dur = Math.max(1, Number.isFinite(duration_s) ? duration_s : 30);
  const rnd = mulberry32(Math.round(dur * 10) + 17);
  const lead = Math.min(0.5, dur * 0.05);
  const target = Math.max(0.5, dur * 0.96 - lead);

  const raw: { w: string; start: number; end: number; sentenceEnd: boolean }[] = [];
  let t = 0;
  let si = Math.floor(rnd() * SENTENCES.length);
  let guard = 0;
  while (t < target && guard++ < 400) {
    const tokens = SENTENCES[si % SENTENCES.length].split(/\s+/);
    si++;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const bare = token.replace(/[^\p{L}\p{N}-]/gu, '');
      const len = Math.max(1, bare.length);
      const wd = 0.16 + 0.04 * len + rnd() * 0.08;
      const start = t;
      const end = t + wd;
      raw.push({ w: token, start, end, sentenceEnd: i === tokens.length - 1 });
      t = end + 0.03 + rnd() * 0.1;
      if (/[,]$/.test(token)) t += 0.15 + rnd() * 0.25;
      if (FILLER_ONLY.includes(bare.toLowerCase())) t += rnd() * 0.15;
    }
    t += 0.55 + rnd() * 0.8;
  }

  let kept = raw.filter((x, i) => x.end <= target || i < 3);
  const lastSentence = kept.map((x) => x.sentenceEnd).lastIndexOf(true);
  if (lastSentence >= kept.length * 0.7) kept = kept.slice(0, lastSentence + 1);
  const lastEnd = kept[kept.length - 1]?.end ?? 1;
  const k = target / lastEnd;
  const words: Word[] = kept.map((x) => ({
    w: x.w,
    start: round2(lead + x.start * k),
    end: round2(lead + x.end * k),
  }));
  return { text: words.map((x) => x.w).join(' '), words };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
