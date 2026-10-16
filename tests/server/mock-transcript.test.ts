import { describe, expect, it } from 'vitest';
import { mockTranscript } from '../../src/server/ai/mock';
import { parseVerbose } from '../../src/server/ai/transcribe';

describe('mockTranscript', () => {
  it('детерминирован по длительности', () => {
    expect(mockTranscript(75)).toEqual(mockTranscript(75));
    expect(mockTranscript(75).text).not.toEqual(mockTranscript(76.5).text);
  });

  it.each([20, 60, 90, 150])('растянут на %i с, темп правдоподобный', (d) => {
    const { words, text } = mockTranscript(d);
    const last = words[words.length - 1];
    expect(last.end).toBeLessThanOrEqual(d);
    expect(last.end).toBeGreaterThan(d * 0.6);
    const wps = words.length / (last.end - words[0].start);
    expect(wps).toBeGreaterThan(1.1);
    expect(wps).toBeLessThan(3);
    expect(text.split(' ')).toHaveLength(words.length);
  });

  it('время монотонно, слова не пустые, есть паразиты', () => {
    const { words, text } = mockTranscript(90);
    words.forEach((w, i) => {
      expect(w.w).not.toBe('');
      expect(w.end).toBeGreaterThan(w.start);
      if (i) expect(w.start).toBeGreaterThanOrEqual(words[i - 1].end - 1e-9);
    });
    expect(text.toLowerCase()).toMatch(/(^|[\s,])(ну|э-э|типа|короче)([\s,.]|$)/);
  });

  it('очень короткая запись не пустая и не падает', () => {
    const { words } = mockTranscript(2);
    expect(words.length).toBeGreaterThanOrEqual(3);
    expect(words[words.length - 1].end).toBeLessThanOrEqual(2);
  });
});

describe('parseVerbose (ответ Groq)', () => {
  it('собирает слова и текст', () => {
    const r = parseVerbose({ text: ' Ну привет ', words: [{ word: ' Ну', start: 0, end: 0.2 }, { word: 'привет', start: 0.3, end: 0.8 }] });
    expect(r.words).toEqual([{ w: 'Ну', start: 0, end: 0.2 }, { w: 'привет', start: 0.3, end: 0.8 }]);
    expect(r.text).toBe('Ну привет');
  });
  it('тишина (no_speech_prob > 0.8) и пустые слова дают пустой результат', () => {
    expect(parseVerbose({ text: 'Продолжение следует', words: [{ word: 'а', start: 0, end: 1 }], segments: [{ no_speech_prob: 0.95 }] }).text).toBe('');
    expect(parseVerbose({ text: '', words: [] }).words).toEqual([]);
  });
});
