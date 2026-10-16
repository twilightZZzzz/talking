import type { Word } from '../../domain/types';

/** Нормализация для сверки цитат: регистр, ё/е, дефисы и пунктуация, пробелы */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[-–—‐]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function quoteInTranscript(quote: string, transcriptNorm: string): boolean {
  const q = normalizeText(quote);
  return q.length > 0 && transcriptNorm.includes(q);
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function clipWords(s: string, max = 12): string {
  const parts = s.trim().split(/\s+/);
  return parts.slice(0, max).join(' ');
}

/** Время (сек) первого слова цитаты в словах транскрипта или undefined */
export function locateQuote(words: Word[], quote: string): number | undefined {
  const q = normalizeText(quote).split(' ').filter(Boolean);
  if (!q.length) return undefined;
  const tokens: { t: string; i: number }[] = [];
  words.forEach((w, i) => normalizeText(w.w).split(' ').filter(Boolean).forEach((t) => tokens.push({ t, i })));
  for (let a = 0; a + q.length <= tokens.length; a++) {
    if (q.every((t, k) => tokens[a + k].t === t)) return words[tokens[a].i].start;
  }
  return undefined;
}
