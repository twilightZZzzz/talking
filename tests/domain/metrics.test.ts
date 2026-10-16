import { describe, expect, it } from 'vitest';
import { computeMetrics } from '../../src/domain/speech/metrics';
import type { Word } from '../../src/domain/types';

/** Слова подряд: шаг 0.5с, длина 0.4с; gaps[i] — доп. пауза перед словом i */
function mk(text: string, gaps: Record<number, number> = {}): Word[] {
  let t = 0;
  return text.split(' ').map((w, i) => {
    t += gaps[i] ?? 0;
    const o = { w, start: t, end: t + 0.4 };
    t += 0.5;
    return o;
  });
}
const forms = (text: string) => computeMetrics(mk(text), 60).fillers.map((f) => [f.word, f.doubtful]);

describe('словарь паразитов', () => {
  it('базовые и нормализация', () => {
    const m = computeMetrics(mk('Э-э, ну я думаю, ТИПА, что это важно'), 10);
    expect(m.fillers.map((f) => f.word)).toEqual(['э', 'ну', 'типа']);
    expect(m.fillers_count).toBe(3);
    expect(m.fillers[0].i).toBe(0);
    expect(m.fillers[2].i).toBe(4);
  });
  it('растянутые звуки приводятся к форме', () => {
    expect(forms('Эээ… я э-э-э ммм ЭМ мм ага')).toEqual([
      ['э', false],
      ['э', false],
      ['м-м', false],
      ['эм', false],
      ['м-м', false],
    ]);
  });
  it('ё→е и пунктуация', () => {
    expect(forms('«Ну», значит. Короче! Вот?')).toEqual([
      ['ну', false],
      ['значит', false],
      ['короче', false],
      ['вот', false],
    ]);
  });
  it('многословные — одно событие на первом слове', () => {
    const m = computeMetrics(mk('Это как бы так сказать в общем это самое важно'), 10);
    expect(m.fillers.map((f) => [f.word, f.i])).toEqual([
      ['как бы', 1],
      ['так сказать', 3],
      ['в общем', 5],
      ['это самое', 7],
    ]);
  });
  it('обычные слова не считаются', () => {
    expect(forms('Я пришёл в общем-то домой и сказал как есть')).toEqual([]);
  });
  it('doubtful', () => {
    expect(forms('Есть два типа клиентов')).toEqual([['типа', true]]);
    expect(forms('Он такой типа ушёл')).toEqual([['типа', false]]);
    expect(forms('Это значит что надо')).toEqual([['значит', true]]);
    expect(forms('Ну значит я пошёл')).toEqual([['ну', false], ['значит', false]]);
    expect(forms('Вот пример из жизни')).toEqual([['вот', true]]);
    expect(forms('Вот я пришёл')).toEqual([['вот', false]]);
  });
  it('doubtful не входят в fillers_count и fpm', () => {
    const m = computeMetrics(mk('Вот пример и ну два типа клиентов'), 6);
    expect(m.fillers).toHaveLength(3);
    expect(m.fillers_count).toBe(1);
  });
  it('excluded: остаются в списке, но не считаются', () => {
    const w = mk('Ну я э-э думаю как бы так');
    const m = computeMetrics(w, 10, [0, 5]);
    expect(m.fillers.map((f) => [f.word, f.doubtful])).toEqual([
      ['ну', true],
      ['э', false],
      ['как бы', true],
    ]);
    expect(m.fillers_count).toBe(1);
  });
});

describe('темп и паузы', () => {
  it('wpm за речевой интервал', () => {
    const text = Array.from({ length: 60 }, (_, i) => `слово${i}`).join(' ');
    const m = computeMetrics(mk(text), 40);
    expect(m.word_count).toBe(60);
    expect(m.speech_s).toBe(29.9);
    expect(m.wpm).toBe(120);
    expect(m.duration_s).toBe(40);
    expect(m.pauses).toEqual([]);
    expect(m.pauses_per_min).toBe(0);
  });
  it('паузы > 0.7с', () => {
    const text = Array.from({ length: 60 }, (_, i) => `слово${i}`).join(' ');
    const m = computeMetrics(mk(text, { 10: 1, 30: 0.8, 40: 0.5 }), 40);
    // зазор между словами = 0.1 + пауза; 0.5+0.1 < 0.7
    expect(m.pauses).toHaveLength(2);
    expect(m.pauses[0].len).toBeCloseTo(1.1, 2);
    expect(m.pauses[1].len).toBeCloseTo(0.9, 2);
    expect(m.pauses_per_min).toBeGreaterThan(3);
  });
  it('fpm округляется до 0.1', () => {
    const text = 'ну ' + Array.from({ length: 58 }, (_, i) => `слово${i}`).join(' ') + ' ну';
    const m = computeMetrics(mk(text), 31);
    expect(m.fillers_count).toBe(2);
    expect(m.fpm).toBe(4);
  });
  it('пустой ввод', () => {
    const m = computeMetrics([], 12);
    expect(m).toMatchObject({ word_count: 0, wpm: 0, fpm: 0, speech_s: 0, fillers_count: 0, pauses_per_min: 0 });
    expect(m.repetitions).toEqual([]);
  });
});

describe('повторы', () => {
  it('значимое слово ≥3 раз в окне 20 слов', () => {
    const m = computeMetrics(mk('Наш проект важен потому что проект даёт деньги а проект ещё и растёт'), 10);
    expect(m.repetitions).toEqual([{ word: 'проект', count: 3, t: expect.any(Number) }]);
    expect(m.repetitions[0].t).toBe(0.5);
  });
  it('далеко друг от друга — не повтор', () => {
    const filler = Array.from({ length: 25 }, (_, i) => `шум${i}`).join(' ');
    const m = computeMetrics(mk(`проект ${filler} проект ${filler} проект`), 60);
    expect(m.repetitions).toEqual([]);
  });
  it('короткие, стоп-слова и паразиты не считаются', () => {
    const m = computeMetrics(mk('это это это когда когда когда дом дом дом короче короче короче'), 10);
    expect(m.repetitions).toEqual([]);
  });
});
