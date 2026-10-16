// Определение возможностей записи. Выбор MIME вынесен в чистую функцию — тестируется без браузера.

export const AUDIO_MIME_CANDIDATES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'] as const;
export const VIDEO_MIME_CANDIDATES = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'] as const;

/** Первый MIME из списка, который поддерживает браузер; иначе null. */
export function pickSupportedMime(
  candidates: readonly string[],
  isTypeSupported: (mime: string) => boolean,
): string | null {
  for (const mime of candidates) {
    try {
      if (isTypeSupported(mime)) return mime;
    } catch {
      /* некоторые браузеры бросают на незнакомых типах */
    }
  }
  return null;
}

/** 'audio/webm;codecs=opus' → 'audio/webm' (для сервера и Storage параметры не нужны). */
export function baseMime(mime: string): string {
  return mime.split(';')[0].trim().toLowerCase();
}

export interface MediaSupport {
  /** можно записать хотя бы звук (MediaRecorder или запасной PCM-путь) */
  canRecord: boolean;
  canRecordVideo: boolean;
  /** MIME для MediaRecorder только-аудио; null → будет запасной WAV */
  audioMime: string | null;
  videoMime: string | null;
  isIOS: boolean;
  isStandalonePWA: boolean;
}

type AudioCtxCtor = typeof AudioContext;

export function getAudioContextCtor(): AudioCtxCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: AudioCtxCtor; webkitAudioContext?: AudioCtxCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ выдаёт себя за Mac
  return navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1;
}

export function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  try {
    return window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  } catch {
    return false;
  }
}

export function mediaSupport(): MediaSupport {
  const isIOS = detectIOS();
  const isStandalonePWA = detectStandalone();
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { canRecord: false, canRecordVideo: false, audioMime: null, videoMime: null, isIOS, isStandalonePWA };
  }
  const hasGum = typeof navigator.mediaDevices?.getUserMedia === 'function';
  const hasMR = typeof window.MediaRecorder === 'function';
  const isSupported = (m: string) => hasMR && window.MediaRecorder.isTypeSupported(m);
  const audioMime = hasMR ? pickSupportedMime(AUDIO_MIME_CANDIDATES, isSupported) : null;
  const videoMime = hasMR ? pickSupportedMime(VIDEO_MIME_CANDIDATES, isSupported) : null;
  const canRecord = hasGum && (audioMime !== null || getAudioContextCtor() !== null);
  return {
    canRecord,
    canRecordVideo: canRecord && videoMime !== null,
    audioMime,
    videoMime,
    isIOS,
    isStandalonePWA,
  };
}
