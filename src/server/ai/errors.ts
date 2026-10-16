/** Ошибка ИИ-этапа с понятным пользователю текстом (message — по-русски). */
export class AiError extends Error {
  constructor(
    message: string,
    public readonly retryable = false,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

export function httpStatusOf(e: unknown): number | undefined {
  const s = (e as { status?: unknown } | null)?.status;
  return typeof s === 'number' ? s : undefined;
}

/** 429, 5xx и сетевые сбои стоит повторить один раз */
export function isTransient(e: unknown): boolean {
  const s = httpStatusOf(e);
  if (s !== undefined) return s === 429 || s === 408 || s >= 500;
  const name = (e as { name?: string } | null)?.name ?? '';
  return /Connection|Timeout|Abort|Fetch/i.test(name) || e instanceof TypeError;
}
