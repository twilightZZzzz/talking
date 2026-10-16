// Низкоуровневая запись: getUserMedia + два MediaRecorder (видео+звук для просмотра, только звук для отправки).
// Без React — хук useRecorder лишь оборачивает это состоянием.
import { startPcmCapture, type PcmCapture } from './pcm-capture';
import { baseMime, detectIOS, mediaSupport, getAudioContextCtor } from './support';

export type FacingMode = 'user' | 'environment';

export const MSG_BACKGROUND = 'Запись прервана: приложение ушло в фон';
export const MSG_TRACK_ENDED = 'Запись прервана: камера или микрофон отключились';
export const MSG_NO_AUDIO = 'Звук не записался. Попробуй ещё раз или загрузи видео из галереи';

/** Человекочитаемая ошибка getUserMedia по-русски. */
export function describeMediaError(err: unknown, opts: { audioOnly?: boolean; isIOS?: boolean } = {}): string {
  const what = opts.audioOnly ? 'микрофону' : 'камере и микрофону';
  const where = opts.isIOS ? 'в настройках Safari' : 'в настройках браузера';
  const name = (err as { name?: string } | null)?.name ?? '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
    case 'PermissionDeniedError':
      return `Разреши доступ к ${what} ${where}`;
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return opts.audioOnly ? 'Микрофон не найден' : 'Камера или микрофон не найдены';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'Камера или микрофон заняты другим приложением. Закрой его и попробуй снова';
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return 'Эта камера не подходит. Попробуй переключить камеру';
    case 'TypeError':
      return 'Запись недоступна: нужен защищённый адрес (https)';
    default:
      return 'Не удалось включить камеру и микрофон. Перезапусти приложение и попробуй снова';
  }
}

/** Ошибка с уже готовым русским текстом для пользователя. */
export class MediaUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MediaUserError';
  }
}

export function streamAlive(s: MediaStream | null | undefined): boolean {
  return !!s && s.active && s.getTracks().length > 0 && s.getTracks().every((t) => t.readyState === 'live');
}

export async function acquireStream(opts: { facingMode: FacingMode; audioOnly: boolean }): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new MediaUserError(
      window.isSecureContext === false
        ? 'Запись недоступна: нужен защищённый адрес (https)'
        : 'Этот браузер не умеет записывать. Загрузи видео из галереи',
    );
  }
  const audio: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: false, // шумодав съедает «э» — они нужны для разбора
    autoGainControl: true,
  };
  const video: MediaTrackConstraints | false = opts.audioOnly
    ? false
    : {
        facingMode: { ideal: opts.facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      };
  try {
    return await navigator.mediaDevices.getUserMedia({ audio, video });
  } catch (e) {
    if ((e as { name?: string })?.name === 'OverconstrainedError') {
      // запасной вариант: без ограничений
      return await navigator.mediaDevices.getUserMedia({ audio: true, video: !opts.audioOnly });
    }
    throw e;
  }
}

export function stopStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((t) => {
    try {
      t.stop();
    } catch {
      /* ignore */
    }
  });
}

// ---------- обёртка над одним MediaRecorder ----------

class ChunkRecorder {
  private rec: MediaRecorder;
  private chunks: Blob[] = [];
  failed = false;
  onError?: () => void;

  constructor(stream: MediaStream, readonly mime: string, bitrates: MediaRecorderOptions) {
    this.rec = new MediaRecorder(stream, { mimeType: mime, ...bitrates });
    this.rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    };
    this.rec.onerror = () => {
      this.failed = true;
      this.onError?.();
    };
  }

  start(): void {
    this.rec.start(); // без timeslice: Safari отдаёт один цельный файл на stop
  }

  stop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const finish = () => {
        const blob = this.chunks.length ? new Blob(this.chunks, { type: baseMime(this.mime) }) : null;
        this.chunks = [];
        resolve(blob);
      };
      if (this.rec.state === 'inactive') return finish();
      let done = false;
      const once = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        finish();
      };
      const timer = setTimeout(once, 5000); // страховка: у Safari 'stop' иногда не приходит
      this.rec.onstop = once;
      try {
        this.rec.stop();
      } catch {
        once();
      }
    });
  }

  discard(): void {
    this.rec.ondataavailable = null;
    this.rec.onerror = null;
    this.rec.onstop = null;
    try {
      if (this.rec.state !== 'inactive') this.rec.stop();
    } catch {
      /* ignore */
    }
    this.chunks = [];
  }
}

// ---------- запись дубля ----------

export interface RawRecording {
  videoBlob: Blob | null;
  audioBlob: Blob;
  audioMime: string;
  duration_s: number;
}

export interface TakeRecorderOptions {
  stream: MediaStream;
  audioOnly: boolean;
  maxSeconds: number;
  /** сообщить о необратимой поломке во время записи */
  onFatal: (message: string) => void;
}

export class TakeRecorder {
  private audioRec: ChunkRecorder | null = null;
  private videoRec: ChunkRecorder | null = null;
  private pcm: PcmCapture | null = null;
  private t0 = 0;
  private finished = false;

  constructor(private readonly o: TakeRecorderOptions) {}

  /** Синхронно, из обработчика жеста. Бросает Error с русским текстом, если звук записать нечем. */
  start(): void {
    const sup = mediaSupport();
    const audioStream = new MediaStream(this.o.stream.getAudioTracks());
    this.t0 = performance.now();

    // 1) аудиорекордер (то, что уйдёт на сервер)
    if (sup.audioMime && typeof MediaRecorder === 'function') {
      try {
        const r = new ChunkRecorder(audioStream, sup.audioMime, { audioBitsPerSecond: 64000 });
        r.onError = () => this.onAudioRecorderError();
        r.start();
        this.audioRec = r;
      } catch {
        this.audioRec = null;
      }
    }
    // 2) фолбэк: PCM → WAV
    if (!this.audioRec) this.startPcm();

    // 3) видео (только для просмотра; сбой не критичен)
    if (!this.o.audioOnly && sup.videoMime && typeof MediaRecorder === 'function') {
      try {
        const v = new ChunkRecorder(this.o.stream, sup.videoMime, {
          videoBitsPerSecond: 2_500_000,
          audioBitsPerSecond: 96000,
        });
        v.start();
        this.videoRec = v;
      } catch {
        this.videoRec = null;
      }
    }
  }

  private startPcm(): void {
    if (!getAudioContextCtor()) throw new MediaUserError(MSG_NO_AUDIO);
    try {
      this.pcm = startPcmCapture(this.o.stream);
    } catch {
      throw new MediaUserError(MSG_NO_AUDIO);
    }
  }

  private onAudioRecorderError(): void {
    if (this.finished || this.pcm) return;
    const early = performance.now() - this.t0 < 1500;
    if (early) {
      // упал почти сразу — переключаемся на PCM, потеряв не больше секунды
      this.audioRec?.discard();
      this.audioRec = null;
      try {
        this.startPcm();
        return;
      } catch {
        /* упадём ниже */
      }
    }
    this.o.onFatal(MSG_NO_AUDIO);
  }

  async stop(): Promise<RawRecording> {
    this.finished = true;
    const duration = Math.max(0, Math.min((performance.now() - this.t0) / 1000, this.o.maxSeconds));
    const [videoBlob, audioRes] = await Promise.all([
      this.videoRec ? this.videoRec.stop() : Promise.resolve(null),
      this.stopAudio(),
    ]);
    this.videoRec = null;
    if (!audioRes || audioRes.blob.size < 200) throw new MediaUserError(MSG_NO_AUDIO);
    return {
      videoBlob,
      audioBlob: audioRes.blob,
      audioMime: audioRes.mime,
      duration_s: Math.round(duration * 100) / 100,
    };
  }

  private async stopAudio(): Promise<{ blob: Blob; mime: string } | null> {
    if (this.audioRec) {
      const failed = this.audioRec.failed;
      const mime = baseMime(this.audioRec.mime);
      const blob = await this.audioRec.stop();
      this.audioRec = null;
      return blob && !failed ? { blob, mime } : null;
    }
    if (this.pcm) {
      const res = await this.pcm.stop();
      this.pcm = null;
      return { blob: res.blob, mime: 'audio/wav' };
    }
    return null;
  }

  abort(): void {
    this.finished = true;
    this.audioRec?.discard();
    this.videoRec?.discard();
    this.pcm?.cancel();
    this.audioRec = this.videoRec = null;
    this.pcm = null;
  }
}

export { detectIOS };
