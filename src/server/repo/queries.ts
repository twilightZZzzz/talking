import type { Row } from './mappers';

const PAGE = 1000; // лимит PostgREST по умолчанию

interface Rangeable {
  range(from: number, to: number): PromiseLike<{ data: Row[] | null; error: { message: string } | null }>;
}

/** Выбирает все строки страницами (PostgREST режет ответ до 1000 строк). Запрос должен иметь стабильный order. */
export async function fetchAll(make: () => Rangeable): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await make().range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/** 'YYYY-MM-DD' за N дней до сейчас (UTC, с запасом в сутки на таймзоны не нужен — берём шире). */
export function daysAgoISO(days: number, now = new Date()): string {
  return new Date(now.getTime() - (days + 1) * 86_400_000).toISOString().slice(0, 10);
}

/** Сегодняшняя дата в таймзоне. */
export function todayIn(tz: string, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}
