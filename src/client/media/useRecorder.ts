'use client';
// Хук записи дубля. UI рисует превью (<video srcObject={stream} muted playsInline autoPlay>) и кнопки.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TakeRecorder,
  acquireStream,
  describeMediaError,
  stopStream,
  streamAlive,
  MediaUserError,
  MSG_BACKGROUND,
  MSG_TRACK_ENDED,
  type FacingMode,
} from './recorder';
import { detectIOS } from './support';

export type RecorderState = 'idle' | 'requesting' | 'ready' | 'recording' | 'stopped' | 'error';

export interface RecorderResult {
  /** null, если режим audioOnly или видеорекордер не завёлся */
  videoBlob: Blob | null;
  videoUrl: string | null;
  audioBlob: Blob;
  /** без параметров: 'audio/mp4' | 'audio/webm' | 'audio/wav' */
  audioMime: string;
  duration_s: number;
}

export interface UseRecorderOptions {
  maxSeconds: number;
  facingMode?: FacingMode;
  /** только звук, без камеры */
  audioOnly?: boolean;
  /** открывать камеру при монтировании (по умолчанию true) */
  autoOpen?: boolean;
}

export interface UseRecorder {
  state: RecorderState;
  error?: string;
  stream: MediaStream | null;
  /** секунды от старта записи (по часам, не по счётчику) */
  elapsed: number;
  facing: FacingMode;
  result?: RecorderResult;
  /** запросить доступ и показать превью (state: requesting → ready); возвращает успех */
  open(): Promise<boolean>;
  /** начать запись; при необходимости сам откроет камеру */
  start(): Promise<void>;
  /** остановить и получить result (state: stopped); камера выключается */
  stop(): Promise<void>;
  /** прервать без результата, выключить камеру (state: idle) */
  cancel(): void;
  /** сменить камеру (только в ready) */
  flip(): Promise<void>;
  /** сбросить result/ошибку и заново открыть камеру (для «ещё дубль») */
  reset(): Promise<void>;
}

export function useRecorder(options: UseRecorderOptions): UseRecorder {
  const { maxSeconds, audioOnly = false, autoOpen = true } = options;
  const initialFacing = options.facingMode ?? 'user';

  const [state, setStateRaw] = useState<RecorderState>('idle');
  const [error, setError] = useState<string | undefined>();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [facing, setFacing] = useState<FacingMode>(initialFacing);
  const [result, setResult] = useState<RecorderResult | undefined>();

  const stateRef = useRef<RecorderState>('idle');
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<TakeRecorder | null>(null);
  const facingRef = useRef<FacingMode>(initialFacing);
  const genRef = useRef(0);
  const openingRef = useRef<{ gen: number; p: Promise<boolean> } | null>(null);
  const t0Ref = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppingRef = useRef(false);
  const urlRef = useRef<string | null>(null);
  const maxRef = useRef(maxSeconds);
  useEffect(() => {
    maxRef.current = maxSeconds;
  }, [maxSeconds]);

  const setState = useCallback((s: RecorderState) => {
    stateRef.current = s;
    setStateRaw(s);
  }, []);

  const clearTick = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
  }, []);

  const revokeUrl = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  }, []);

  /** Останавливает треки и отменяет «зависшие» асинхронные open(). */
  const release = useCallback(() => {
    genRef.current++;
    openingRef.current = null;
    clearTick();
    recRef.current?.abort();
    recRef.current = null;
    stopStream(streamRef.current);
    streamRef.current = null;
    setStream(null);
  }, [clearTick]);

  const fail = useCallback(
    (message: string) => {
      stoppingRef.current = false;
      release();
      setResult(undefined);
      revokeUrl();
      setError(message);
      setState('error');
    },
    [release, revokeUrl, setState],
  );

  const open = useCallback((): Promise<boolean> => {
    if (openingRef.current && openingRef.current.gen === genRef.current) return openingRef.current.p;
    if (streamAlive(streamRef.current)) return Promise.resolve(true);
    const gen = genRef.current;
    setError(undefined);
    setState('requesting');
    const p = (async () => {
      try {
        const s = await acquireStream({ facingMode: facingRef.current, audioOnly });
        if (gen !== genRef.current) {
          stopStream(s); // за время запроса компонент размонтировали или вызвали release
          return false;
        }
        s.getTracks().forEach((t) =>
          t.addEventListener('ended', () => {
            if (gen !== genRef.current) return;
            if (stateRef.current === 'recording') fail(MSG_TRACK_ENDED);
            else if (stateRef.current === 'ready') fail('Камера отключилась. Попробуй открыть её снова');
          }),
        );
        streamRef.current = s;
        setStream(s);
        setState('ready');
        return true;
      } catch (e) {
        if (gen !== genRef.current) return false;
        fail(e instanceof MediaUserError ? e.message : describeMediaError(e, { audioOnly, isIOS: detectIOS() }));
        return false;
      } finally {
        if (openingRef.current?.gen === gen) openingRef.current = null;
      }
    })();
    openingRef.current = { gen, p };
    return p;
  }, [audioOnly, fail, setState]);

  const finishRecording = useCallback(async () => {
    const rec = recRef.current;
    if (!rec || stoppingRef.current) return;
    stoppingRef.current = true;
    clearTick();
    const gen = genRef.current;
    try {
      const raw = await rec.stop();
      if (gen !== genRef.current) return; // отменили/размонтировали
      recRef.current = null;
      stopStream(streamRef.current);
      streamRef.current = null;
      setStream(null);
      revokeUrl();
      const videoUrl = raw.videoBlob ? URL.createObjectURL(raw.videoBlob) : null;
      urlRef.current = videoUrl;
      setElapsed(raw.duration_s);
      setResult({
        videoBlob: raw.videoBlob,
        videoUrl,
        audioBlob: raw.audioBlob,
        audioMime: raw.audioMime,
        duration_s: raw.duration_s,
      });
      setState('stopped');
    } catch (e) {
      if (gen === genRef.current) fail(e instanceof MediaUserError ? e.message : 'Не удалось сохранить запись');
    } finally {
      stoppingRef.current = false;
    }
  }, [clearTick, fail, revokeUrl, setState]);

  const start = useCallback(async () => {
    if (stateRef.current === 'recording' || stateRef.current === 'requesting') return;
    if (stateRef.current === 'stopped' || stateRef.current === 'error') {
      revokeUrl();
      setResult(undefined);
    }
    if (!streamAlive(streamRef.current)) {
      const ok = await open();
      if (!ok) return;
    }
    const s = streamRef.current;
    if (!s) return;
    const rec = new TakeRecorder({ stream: s, audioOnly, maxSeconds: maxRef.current, onFatal: fail });
    try {
      rec.start();
    } catch (e) {
      rec.abort();
      fail(e instanceof MediaUserError ? e.message : 'Не удалось начать запись');
      return;
    }
    recRef.current = rec;
    t0Ref.current = performance.now();
    setElapsed(0);
    setError(undefined);
    setState('recording');
    clearTick();
    tickRef.current = setInterval(() => {
      const e = (performance.now() - t0Ref.current) / 1000;
      setElapsed(Math.min(Math.round(e * 10) / 10, maxRef.current));
      if (e >= maxRef.current) void finishRecording();
    }, 100);
  }, [audioOnly, clearTick, fail, finishRecording, open, revokeUrl, setState]);

  const stop = useCallback(async () => {
    if (stateRef.current !== 'recording') return;
    await finishRecording();
  }, [finishRecording]);

  const cancel = useCallback(() => {
    stoppingRef.current = false;
    release();
    revokeUrl();
    setResult(undefined);
    setError(undefined);
    setElapsed(0);
    setState('idle');
  }, [release, revokeUrl, setState]);

  const reset = useCallback(async () => {
    cancel();
    await open();
  }, [cancel, open]);

  const flip = useCallback(async () => {
    if (audioOnly) return;
    if (stateRef.current !== 'ready' && stateRef.current !== 'idle') return;
    const next: FacingMode = facingRef.current === 'user' ? 'environment' : 'user';
    facingRef.current = next;
    setFacing(next);
    release();
    await open();
  }, [audioOnly, open, release]);

  // Уход в фон = запись прервана (iOS замораживает захват, получится битый файл).
  useEffect(() => {
    const onHide = () => {
      if (stateRef.current === 'recording') fail(MSG_BACKGROUND);
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') onHide();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
    };
  }, [fail]);

  // Автооткрытие и гарантированное освобождение камеры при размонтировании.
  useEffect(() => {
    if (autoOpen) void open();
    return () => {
      release();
      revokeUrl();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { state, error, stream, elapsed, facing, result, open, start, stop, cancel, flip, reset };
}
