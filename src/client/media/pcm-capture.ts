// Запасной путь записи звука: AudioContext + ScriptProcessor → PCM 16 кГц → WAV.
// Нужен, если MediaRecorder для аудио недоступен или упал на старте (баг двух рекордеров на одном потоке в iOS).
// ScriptProcessor устарел, но синхронен и стабильно работает в Safari (AudioWorklet требует async addModule).
import { downsample, encodeWav, mergeFloat32 } from './wav';
import { getAudioContextCtor } from './support';

export interface PcmResult {
  blob: Blob; // audio/wav, 16 кГц, моно, 16 бит
  duration_s: number;
}

export interface PcmCapture {
  stop(): Promise<PcmResult>;
  cancel(): void;
}

/** Вызывать синхронно из обработчика жеста (iOS: AudioContext стартует только после касания). */
export function startPcmCapture(stream: MediaStream): PcmCapture {
  const Ctor = getAudioContextCtor();
  if (!Ctor) throw new Error('AudioContext недоступен');
  const audioTracks = stream.getAudioTracks();
  if (audioTracks.length === 0) throw new Error('Нет аудиодорожки');

  const ctx = new Ctor();
  void ctx.resume().catch(() => undefined);
  const source = ctx.createMediaStreamSource(new MediaStream(audioTracks));
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  const mute = ctx.createGain();
  mute.gain.value = 0; // без этого в Safari onaudioprocess не вызывается; звук в динамик не идёт
  const chunks: Float32Array[] = [];
  let samples = 0;
  let closed = false;

  processor.onaudioprocess = (e) => {
    if (closed) return;
    const data = e.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(data)); // копия: буфер переиспользуется
    samples += data.length;
  };
  source.connect(processor);
  processor.connect(mute);
  mute.connect(ctx.destination);

  const teardown = () => {
    if (closed) return;
    closed = true;
    processor.onaudioprocess = null;
    try {
      source.disconnect();
      processor.disconnect();
      mute.disconnect();
    } catch {
      /* уже отключено */
    }
    void ctx.close().catch(() => undefined);
  };

  return {
    async stop() {
      const rate = ctx.sampleRate;
      teardown();
      const merged = mergeFloat32(chunks);
      chunks.length = 0;
      const pcm16 = downsample(merged, rate, 16000);
      return { blob: encodeWav(pcm16, 16000), duration_s: samples / rate };
    },
    cancel() {
      teardown();
      chunks.length = 0;
    },
  };
}
