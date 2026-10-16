import { describe, expect, it } from 'vitest';
import { downsample, encodeWav, encodeWavBuffer } from '../../src/client/media/wav';
import {
  AUDIO_MIME_CANDIDATES,
  VIDEO_MIME_CANDIDATES,
  baseMime,
  pickSupportedMime,
} from '../../src/client/media/support';

describe('encodeWav', () => {
  const samples = new Float32Array([0, 0.5, -0.5, 1, -1, 2]);
  const buf = encodeWavBuffer(samples, 16000);
  const v = new DataView(buf);
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));

  it('пишет корректный RIFF/WAVE заголовок', () => {
    expect(tag(0)).toBe('RIFF');
    expect(tag(8)).toBe('WAVE');
    expect(tag(12)).toBe('fmt ');
    expect(tag(36)).toBe('data');
    expect(v.getUint16(20, true)).toBe(1); // PCM
    expect(v.getUint16(22, true)).toBe(1); // моно
    expect(v.getUint16(34, true)).toBe(16);
  });

  it('частота и размеры совпадают', () => {
    expect(v.getUint32(24, true)).toBe(16000);
    expect(v.getUint32(28, true)).toBe(32000);
    expect(v.getUint32(40, true)).toBe(samples.length * 2);
    expect(v.getUint32(4, true)).toBe(36 + samples.length * 2);
    expect(buf.byteLength).toBe(44 + samples.length * 2);
  });

  it('кодирует сэмплы с ограничением по амплитуде', () => {
    expect(v.getInt16(44, true)).toBe(0);
    expect(v.getInt16(46, true)).toBe(16384);
    expect(v.getInt16(50, true)).toBe(32767);
    expect(v.getInt16(52, true)).toBe(-32768);
    expect(v.getInt16(54, true)).toBe(32767); // 2 → клип
  });

  it('Blob имеет тип audio/wav и нужный размер', async () => {
    const blob = encodeWav(samples, 16000);
    expect(blob.type).toBe('audio/wav');
    expect(blob.size).toBe(44 + 12);
    expect((await blob.arrayBuffer()).byteLength).toBe(56);
  });
});

describe('downsample', () => {
  it('понижает 48 кГц до 16 кГц (в 3 раза)', () => {
    const out = downsample(new Float32Array(4800).fill(0.25), 48000, 16000);
    expect(out.length).toBe(1600);
    expect(out[10]).toBeCloseTo(0.25);
  });
  it('не повышает частоту', () => {
    const inp = new Float32Array(10);
    expect(downsample(inp, 8000, 16000)).toBe(inp);
  });
});

describe('pickSupportedMime', () => {
  it('Safari: берёт audio/mp4 первым', () => {
    const safari = (m: string) => m === 'audio/mp4' || m === 'video/mp4';
    expect(pickSupportedMime(AUDIO_MIME_CANDIDATES, safari)).toBe('audio/mp4');
    expect(pickSupportedMime(VIDEO_MIME_CANDIDATES, safari)).toBe('video/mp4');
  });
  it('Firefox: opus в webm', () => {
    const ff = (m: string) => m.startsWith('audio/webm') || m === 'video/webm';
    expect(pickSupportedMime(AUDIO_MIME_CANDIDATES, ff)).toBe('audio/webm;codecs=opus');
    expect(pickSupportedMime(VIDEO_MIME_CANDIDATES, ff)).toBe('video/webm');
  });
  it('возвращает null, если ничего не поддерживается или проверка бросает', () => {
    expect(pickSupportedMime(AUDIO_MIME_CANDIDATES, () => false)).toBeNull();
    expect(
      pickSupportedMime(['a', 'b'], (m) => {
        if (m === 'a') throw new Error('boom');
        return true;
      }),
    ).toBe('b');
  });
  it('baseMime отбрасывает параметры', () => {
    expect(baseMime('audio/webm;codecs=opus')).toBe('audio/webm');
    expect(baseMime('audio/mp4')).toBe('audio/mp4');
  });
});
