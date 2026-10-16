// Загрузка дубля и запуск разбора: POST /api/takes → PUT в Storage по signed URL → transcribe → feedback.
import type { Take, TakeContext } from '../../domain/types';
import { baseMime } from './support';

export type Stage = 'upload' | 'transcribe' | 'feedback' | 'done';

export interface UploadTakeParams {
  id: string;
  session_date: string;
  context: TakeContext;
  exercise_id?: string | null;
  topic?: string | null;
  frame_id?: string | null;
  challenge_id?: string | null;
  source: 'record' | 'upload';
  audioBlob: Blob;
  audioMime: string;
  duration_s: number;
  /** доля 0..1 загруженных байт */
  onProgress?: (fraction: number) => void;
}

export const MSG_NETWORK = 'Нет связи с сервером. Проверь интернет и попробуй ещё раз';

class NetworkError extends Error {
  constructor(message = MSG_NETWORK) {
    super(message);
    this.name = 'NetworkError';
  }
}
class HttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'HttpError';
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const retryable = e instanceof NetworkError || (e instanceof HttpError && e.status >= 500);
      if (!retryable || attempt >= retries) throw e;
      await sleep(800);
    }
  }
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const j = (await res.json()) as { error?: unknown };
    if (typeof j?.error === 'string' && j.error) return j.error;
  } catch {
    /* не JSON */
  }
  return fallback;
}

async function api<T>(url: string, init: RequestInit = {}, timeoutMs = 150_000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      credentials: 'same-origin',
      ...init,
      headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers },
      signal: ctrl.signal,
    });
  } catch {
    throw new NetworkError();
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new HttpError(await errorMessage(res, `Ошибка сервера (${res.status}). Попробуй ещё раз`), res.status);
  }
  try {
    return (await res.json()) as T;
  } catch {
    return {} as T;
  }
}

interface CreateTakeResponse {
  take_no: number;
  path: string;
  token: string;
  signedUrl: string;
}

/** PUT тела на signed URL Supabase Storage (как uploadToSignedUrl: x-upsert + Content-Type), с прогрессом. */
function putSigned(url: string, blob: Blob, mime: string, onProgress?: (f: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', mime);
    xhr.setRequestHeader('x-upsert', 'true'); // повторная загрузка того же дубля безопасна
    xhr.setRequestHeader('cache-control', 'max-age=3600');
    xhr.timeout = 120_000;
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) onProgress(Math.min(1, e.loaded / e.total));
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        return resolve();
      }
      let msg = `Не удалось загрузить звук (код ${xhr.status}). Попробуй ещё раз`;
      try {
        const j = JSON.parse(xhr.responseText) as { error?: string; message?: string };
        if (xhr.status < 500 && (j.message || j.error)) msg = `Не удалось загрузить звук: ${j.message || j.error}`;
      } catch {
        /* не JSON */
      }
      reject(new HttpError(msg, xhr.status));
    };
    xhr.onerror = xhr.ontimeout = () => reject(new NetworkError());
    xhr.send(blob);
  });
}

export async function uploadTake(p: UploadTakeParams): Promise<{ take_no: number }> {
  const mime = baseMime(p.audioMime);
  const created = await withRetry(() =>
    api<CreateTakeResponse>('/api/takes', {
      method: 'POST',
      body: JSON.stringify({
        id: p.id,
        session_date: p.session_date,
        context: p.context,
        exercise_id: p.exercise_id ?? null,
        topic: p.topic ?? null,
        frame_id: p.frame_id ?? null,
        challenge_id: p.challenge_id ?? null,
        source: p.source,
        mime,
        duration_s: p.duration_s,
      }),
    }),
  );
  if (!created?.signedUrl) throw new Error('Сервер не выдал ссылку для загрузки. Попробуй ещё раз');
  await withRetry(() => putSigned(created.signedUrl, p.audioBlob, mime, p.onProgress));
  return { take_no: created.take_no };
}

/**
 * Разбор уже загруженного дубля. `from: 'feedback'` — продолжить после сбоя Claude (транскрипт уже есть).
 * Возвращает итоговый Take.
 */
/** Ошибка этапа разбора; stage — где упало ('transcribe' | 'feedback') */
export class StageError extends Error {
  constructor(message: string, public stage: string | null) {
    super(message);
  }
}

export async function runAnalysis(
  id: string,
  onStage?: (s: Stage) => void,
  opts: { from?: 'transcribe' | 'feedback' } = {},
): Promise<Take> {
  const base = `/api/takes/${encodeURIComponent(id)}`;
  // сервер отвечает 200 и Take со status 'failed', если этап не удался
  const check = (t: Take | { take: Take }) => {
    const take = 'take' in t ? t.take : t;
    if (take.status === 'failed') throw new StageError(take.error ?? 'Не получилось разобрать дубль', take.failed_stage);
    return take;
  };
  if (opts.from !== 'feedback') {
    onStage?.('transcribe');
    check(await withRetry(() => api<Take | { take: Take }>(`${base}/transcribe`, { method: 'POST', body: '{}' })));
  }
  onStage?.('feedback');
  const take = check(await withRetry(() => api<Take | { take: Take }>(`${base}/feedback`, { method: 'POST', body: '{}' })));
  onStage?.('done');
  return take;
}

/** Всё сразу: загрузка → транскрипция → разбор. */
export async function uploadAndAnalyze(
  params: UploadTakeParams,
  onStage?: (s: Stage) => void,
): Promise<Take> {
  onStage?.('upload');
  await uploadTake(params);
  return runAnalysis(params.id, onStage);
}
