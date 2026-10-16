// Звук из файла (видео/аудио из галереи) → WAV 16 кГц моно 16 бит.
import { encodeWav } from './wav';
import { getAudioContextCtor } from './support';

export const MSG_EXTRACT_FAILED = 'Не удалось достать звук из этого файла. Запиши дубль прямо в приложении';
const TARGET_RATE = 16000;

export interface ExtractOptions {
  maxSeconds?: number;
  maxBytes?: number;
}

export interface ExtractedAudio {
  audioBlob: Blob;
  duration_s: number;
  /** blob:-ссылка на исходный файл для <video>; освободи через URL.revokeObjectURL */
  videoUrl: string;
}

function fmt(sec: number): string {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function tooLong(duration: number, max: number): Error {
  return new Error(`Дубль слишком длинный: ${fmt(duration)}. Максимум — ${fmt(max)}. Обрежь ролик или запиши заново`);
}

/** Длительность по метаданным <video>, без чтения файла целиком. NaN — если узнать не удалось. */
export function readDuration(url: string, timeoutMs = 8000): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.playsInline = true;
    let done = false;
    const finish = (d: number) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      v.onloadedmetadata = v.onerror = null;
      v.removeAttribute('src');
      v.load(); // освобождает ресурс (важно для iOS)
      resolve(d);
    };
    const timer = setTimeout(() => finish(NaN), timeoutMs);
    v.onloadedmetadata = () => finish(Number.isFinite(v.duration) ? v.duration : NaN);
    v.onerror = () => finish(NaN);
    v.src = url;
  });
}

function decode(ctx: AudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  // Старый Safari: только callback-форма; новый — промис. Поддерживаем обе.
  return new Promise((resolve, reject) => {
    try {
      const p = ctx.decodeAudioData(data, resolve, reject) as Promise<AudioBuffer> | undefined;
      p?.then?.(resolve, reject);
    } catch (e) {
      reject(e);
    }
  });
}

export async function extractAudioFromFile(file: File, opts: ExtractOptions = {}): Promise<ExtractedAudio> {
  const maxSeconds = opts.maxSeconds ?? 150;
  const maxBytes = opts.maxBytes ?? 500 * 1024 * 1024;

  if (!file || file.size === 0) throw new Error('Файл пустой. Выбери другое видео');
  if (file.size > maxBytes) {
    throw new Error(`Файл слишком большой (${Math.round(file.size / 1048576)} МБ). Максимум — ${Math.round(maxBytes / 1048576)} МБ`);
  }
  if (file.type && !/^(video|audio)\//.test(file.type)) {
    throw new Error('Это не видео и не аудио. Выбери ролик из галереи');
  }

  const videoUrl = URL.createObjectURL(file);
  let ctx: AudioContext | null = null;
  try {
    const metaDuration = await readDuration(videoUrl);
    if (Number.isFinite(metaDuration) && metaDuration > maxSeconds + 0.5) throw tooLong(metaDuration, maxSeconds);

    const Ctor = getAudioContextCtor();
    if (!Ctor) throw new Error(MSG_EXTRACT_FAILED);

    let buffer: AudioBuffer;
    try {
      let bytes: ArrayBuffer | null = await file.arrayBuffer();
      ctx = new Ctor();
      buffer = await decode(ctx, bytes);
      bytes = null; // отдаём память сборщику
    } catch {
      throw new Error(MSG_EXTRACT_FAILED);
    }
    const duration = buffer.duration;
    if (duration > maxSeconds + 0.5) throw tooLong(duration, maxSeconds);
    if (duration < 0.3) throw new Error('В файле почти нет звука. Выбери другое видео');

    const OfflineCtor: typeof OfflineAudioContext =
      window.OfflineAudioContext ??
      (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
    let samples: Float32Array;
    try {
      const off = new OfflineCtor(1, Math.max(1, Math.ceil(duration * TARGET_RATE)), TARGET_RATE);
      const src = off.createBufferSource();
      src.buffer = buffer;
      src.connect(off.destination); // многоканальный звук сводится в моно
      src.start(0);
      const rendered = await new Promise<AudioBuffer>((resolve, reject) => {
        const p = off.startRendering() as Promise<AudioBuffer> | undefined;
        if (p?.then) p.then(resolve, reject);
        else off.oncomplete = (e) => resolve(e.renderedBuffer); // старый Safari
      });
      samples = rendered.getChannelData(0);
    } catch {
      throw new Error(MSG_EXTRACT_FAILED);
    }
    return { audioBlob: encodeWav(samples, TARGET_RATE), duration_s: Math.round(duration * 100) / 100, videoUrl };
  } catch (e) {
    URL.revokeObjectURL(videoUrl);
    throw e instanceof Error ? e : new Error(MSG_EXTRACT_FAILED);
  } finally {
    if (ctx) void ctx.close().catch(() => undefined);
  }
}
