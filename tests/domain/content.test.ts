import { describe, expect, it } from 'vitest';
import { CHALLENGES, FRAMES, TOPICS, TWISTERS, getChallenge, getFrame, getTopicText } from '../../src/domain/content';
import { EXERCISES, getExercise, recommendExercises, rulesPlan } from '../../src/domain/exercises';
import { buildProfile } from '../../src/domain/problems/events';
import type { ProblemEvent } from '../../src/domain/types';

describe('контент', () => {
  it('стабильные id и размеры', () => {
    expect(TWISTERS).toHaveLength(15);
    expect(TWISTERS[0].id).toBe('tw-01');
    expect(TOPICS.length).toBeGreaterThanOrEqual(35);
    expect(TOPICS[0].id).toBe('topic-01');
    expect(new Set(TOPICS.map((t) => t.id)).size).toBe(TOPICS.length);
    expect(FRAMES.map((f) => f.id)).toEqual(['prep', 'ppr', 'bsk', 'three', 'thv']);
    expect(getFrame('prep')!.points[0].id).toBe('prep.position');
    const ids = FRAMES.flatMap((f) => f.points.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(getTopicText('topic-01')).toBe('Почему ты вечно уставший, хотя спишь 8 часов');
  });
  it('челленджи', () => {
    for (const id of ['no-korotche', 'question-open', 'three-pauses', 'slower', 'cta-end', 'no-i-start', 'one-story', 'number', 'eye-contact']) {
      expect(getChallenge(id)).toBeDefined();
    }
    expect(CHALLENGES.filter((c) => !c.assessable).map((c) => c.id).sort()).toEqual(['eye-contact', 'slower']);
    expect(CHALLENGES.length).toBeGreaterThanOrEqual(12);
  });
});

describe('упражнения', () => {
  it('библиотека и шаги ритуала', () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(28);
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
    expect([0, 1, 2, 3, 4].map((i) => getExercise(`ritual-${i}`)!.minutes)).toEqual([3, 2, 5, 3, 2]);
    expect(getExercise('ritual-2')).toMatchObject({ speaking: true, needs_topic: true, needs_frame: true, take_s: 90, prep_s: 30 });
    expect(getExercise('ritual-3')!.speaking).toBe(false);
    for (const e of EXERCISES) {
      expect(e.instructions.length).toBeGreaterThanOrEqual(2);
      expect(e.instructions.length).toBeLessThanOrEqual(5);
      expect(e.success).toBeTruthy();
      if (e.speaking) expect(e.take_s).toBeGreaterThan(0);
    }
    const cats = new Set(EXERCISES.map((e) => e.category));
    expect(cats.size).toBe(7);
  });

  const events: ProblemEvent[] = [
    { code: 'fillers', severity: 0.9, evidence: { words: ['типа', 'типа', 'ну'] }, created_at: '2026-10-15T00:00:00Z', take_id: 't1' },
    { code: 'run_on', severity: 0.7, evidence: {}, created_at: '2026-10-15T00:00:00Z', take_id: 't1' },
  ];
  const profile = buildProfile(events, [], new Date('2026-10-16T00:00:00Z'));

  it('recommendExercises: детерминированно, без ritual и exclude', () => {
    const a = recommendExercises(profile, { count: 5, seed: 7 });
    const b = recommendExercises(profile, { count: 5, seed: 7 });
    expect(a.map((e) => e.id)).toEqual(b.map((e) => e.id));
    expect(a).toHaveLength(5);
    expect(a.some((e) => e.id.startsWith('ritual-'))).toBe(false);
    const ex = recommendExercises(profile, { count: 5, seed: 7, exclude: [a[0].id] });
    expect(ex.map((e) => e.id)).not.toContain(a[0].id);
    const top = recommendExercises(profile, { count: 3, seed: 1 });
    expect(top.filter((e) => e.targets.some((t) => t === 'fillers' || t === 'run_on')).length).toBeGreaterThanOrEqual(2);
  });

  it('rulesPlan: 4 пункта, паразит подставлен', () => {
    const plan = rulesPlan(profile, { seed: 3, now: '2026-10-16T00:00:00Z' });
    expect(plan).toHaveLength(4);
    expect(new Set(plan.map((p) => p.id)).size).toBe(4);
    for (const p of plan) {
      expect(p.base_exercise_id && getExercise(p.base_exercise_id)).toBeTruthy();
      expect(p.why).toBeTruthy();
      if (p.speaking) expect(p.take_s).toBeGreaterThan(0);
    }
    const fillerItem = plan.find((p) => p.why.includes('«типа»'));
    expect(fillerItem?.why).toContain('2 раза');
    expect(rulesPlan(profile, { seed: 3, now: 'x' })).toEqual(plan);
  });

  it('rulesPlan для пустого профиля работает', () => {
    const plan = rulesPlan(buildProfile([], [], new Date()), { seed: 1, now: 'x' });
    expect(plan).toHaveLength(4);
  });
});
