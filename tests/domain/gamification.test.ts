import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, checkAchievements } from '../../src/domain/gamification/achievements';
import { computeStats, type StatsInput } from '../../src/domain/gamification/calc';
import { LEVELS, levelFor, prepSecondsFor, unlocks } from '../../src/domain/gamification/levels';
import type { Activity, Session, TakeSummary } from '../../src/domain/types';

// ---------- legacy calc() дословно из legacy/index.html ----------
type LegacyLog = { f: number; r: number; n?: string; ch: boolean; full: boolean; t?: number };
interface LegacySt { log: Record<string, LegacyLog>; done: Record<string, number[]> }
const LV = [[0, 'Новичок'], [150, 'Разговорчивый'], [400, 'Собранный'], [800, 'Чёткий'], [1400, 'Уверенный'], [2200, 'Спикер'], [3200, 'Оратор'], [4500, 'Голос эфира']] as const;

function legacyCalc(st: LegacySt, now: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const dk = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const key = dk(now);
  function streakAt(dateStr: string) { let n = 0, d = new Date(dateStr + 'T12:00'); while (st.log[dk(d)]) { n++; d = addDays(d, -1); } return n; }
  const days = [...new Set([...Object.keys(st.log), ...Object.keys(st.done)])].sort();
  let xp = 0, best: number | null = null, records = 0, full = 0, ch = 0;
  const perDay: Record<string, { xp: number; rec: boolean; m: number }> = {};
  for (const d of days) {
    const e = st.log[d], dn = st.done[d] || [];
    let x = dn.length * 10; let rec = false;
    if (e) {
      x += 20; if (e.ch) { x += 25; ch++; }
      if (e.full) { x += 30; full++; }
      if (best !== null && e.f < best) { x += 30; records++; rec = true; }
      if (best === null || e.f < best) best = e.f;
    }
    const s = e ? streakAt(d) : 0; const m = Math.min(1.5, 1 + Math.max(0, s - 1) * 0.1);
    const got = Math.round(x * m); xp += got; perDay[d] = { xp: got, rec, m };
  }
  let lv = 0; for (let i = 0; i < LV.length; i++) if (xp >= LV[i][0]) lv = i;
  let cur = streakAt(key); if (!st.log[key]) cur = streakAt(dk(addDays(now, -1)));
  const mon = addDays(now, -((now.getDay() + 6) % 7)); let wk = 0; for (let i = 0; i < 7; i++) if (st.log[dk(addDays(mon, i))]) wk++;
  return { xp, lv, best, records, full, ch, cur, wk, perDay };
}

// ---------- помощники ----------
const L = (f: number, r: number, ch: boolean, full: boolean, t?: number): LegacyLog => ({ f, r, ch, full, t });
const session = (date: string, p: Partial<Session> = {}): Session => ({
  date, mode: 'full', topic_id: null, custom_topic: null, frame_id: null, challenge_id: null, twister_id: null,
  content_version: 1, steps_done: [], breath: null, fillers: null, clarity: null, challenge_done: null, note: null,
  saved_at: null, saved_hour: null, full: false, ...p,
});
let seq = 0;
const act = (date: string, kind: Activity['kind'], ref: string, duration_s: number, meta: Activity['meta'] = {}, at = '12:00:00'): Activity => ({
  id: `a${++seq}`, date, kind, ref, duration_s, meta, created_at: `${date}T${at}Z`,
});
const take = (date: string, id: string, dur: number, meta: Activity['meta'] = {}, at = '08:00:00') => act(date, 'take', id, dur, meta, at);

function fromLegacy(st: LegacySt, today: string, asActivities: boolean): StatsInput {
  const dates = [...new Set([...Object.keys(st.log), ...Object.keys(st.done)])].sort();
  const sessions = dates.map((d) => {
    const e = st.log[d];
    const done = st.done[d] ?? [];
    return session(d, {
      steps_done: asActivities ? [] : done,
      ...(e ? { saved_at: `${d}T08:00:00Z`, saved_hour: e.t ?? null, fillers: e.f, clarity: e.r || null, challenge_done: e.ch, full: e.full } : {}),
    });
  });
  const activities = asActivities ? dates.flatMap((d) => (st.done[d] ?? []).map((i) => act(d, 'ritual_step', String(i), 0))) : [];
  return { sessions, activities, takes: [], today, dailyGoalMin: 999 };
}

const HISTORIES: Record<string, { st: LegacySt; todays: string[] }> = {
  'A: пять дней подряд с рекордами': {
    st: {
      log: {
        '2026-10-01': L(9, 3, false, false, 8),
        '2026-10-02': L(7, 4, true, true, 7),
        '2026-10-03': L(7, 4, false, false, 10),
        '2026-10-04': L(4, 5, true, false, 9),
        '2026-10-05': L(2, 5, true, true, 6),
      },
      done: { '2026-10-01': [0, 3], '2026-10-02': [0, 1, 2, 3, 4], '2026-10-03': [2, 3], '2026-10-04': [0, 2, 3], '2026-10-05': [0, 1, 2, 3, 4] },
    },
    todays: ['2026-10-05', '2026-10-06', '2026-10-08'],
  },
  'B: разрывы, дни без итога, рекорд после паузы': {
    st: {
      log: {
        '2026-10-01': L(10, 2, false, false),
        '2026-10-02': L(8, 3, true, false),
        '2026-10-04': L(8, 3, false, true),
        '2026-10-05': L(6, 4, true, true),
        '2026-10-06': L(6, 4, false, false),
        '2026-10-08': L(3, 5, true, false),
      },
      done: { '2026-10-02': [3], '2026-10-03': [0], '2026-10-04': [0, 1, 2, 3, 4], '2026-10-05': [3], '2026-10-07': [1, 4], '2026-10-08': [2, 3] },
    },
    todays: ['2026-10-08', '2026-10-09', '2026-10-12'],
  },
  'C: серия 12 дней, потолок множителя ×1.5': {
    st: {
      log: Object.fromEntries(
        Array.from({ length: 12 }, (_, i) => [`2026-10-${String(i + 1).padStart(2, '0')}`, L([9, 8, 8, 7, 7, 5, 6, 5, 4, 4, 4, 2][i], 4, i % 2 === 0, i % 3 === 0)]),
      ),
      done: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`2026-10-${String(i + 1).padStart(2, '0')}`, i % 3 === 0 ? [0, 1, 2, 3, 4] : [2, 3]])),
    },
    todays: ['2026-10-12', '2026-10-13', '2026-10-15'],
  },
};

describe('XP совпадает с legacy calc()', () => {
  for (const [name, { st, todays }] of Object.entries(HISTORIES)) {
    for (const today of todays) {
      for (const asActivities of [false, true]) {
        it(`${name}; today=${today}; шаги ${asActivities ? 'activities' : 'steps_done'}`, () => {
          const [y, m, d] = today.split('-').map(Number);
          const lg = legacyCalc(st, new Date(y, m - 1, d, 12));
          const s = computeStats(fromLegacy(st, today, asActivities));
          expect(s.xp).toBe(lg.xp);
          expect(s.level.index).toBe(lg.lv);
          expect(s.bestFillers).toBe(lg.best);
          expect(s.records).toBe(lg.records);
          expect(s.fullCount).toBe(lg.full);
          expect(s.challengeCount).toBe(lg.ch);
          expect(s.streak).toBe(lg.cur);
          expect(s.weekActive).toBe(lg.wk);
          for (const [date, p] of Object.entries(lg.perDay)) {
            expect(s.perDay[date].xp).toBe(p.xp);
            expect(s.perDay[date].multiplier).toBe(p.m);
            expect(s.perDay[date].record).toBe(p.rec);
          }
        });
      }
    }
  }
  it('контрольные числа (зафиксированы вручную)', () => {
    const { st } = HISTORIES['A: пять дней подряд с рекордами'];
    const s = computeStats(fromLegacy(st, '2026-10-05', false));
    // день1: 2·10+20=40×1.0; день2: 50+20+25+30+30(рекорд 7<9)=155×1.1=171; день3: 20+20=40×1.2=48;
    // день4: 30+20+25+30(рекорд 4<7)=105×1.3=137; день5: 50+20+25+30+30=155×1.4=217
    expect(Object.values(s.perDay).map((p) => p.xp)).toEqual([40, 171, 48, 137, 217]);
    expect(s.xp).toBe(613);
    expect(s.level.name).toBe('Собранный');
    expect(s.streak).toBe(5);
    expect(s.multiplier).toBe(1.4);
  });
});

describe('серия и множитель', () => {
  const base = { takes: [], dailyGoalMin: 999 };
  it('если сегодня не активен, серия считается от вчера; множитель для сегодня', () => {
    const sessions = ['2026-10-13', '2026-10-14', '2026-10-15'].map((d) => session(d, { saved_at: d + 'T08:00:00Z', fillers: 3 }));
    const s = computeStats({ ...base, sessions, activities: [], today: '2026-10-16' });
    expect(s.streak).toBe(3);
    expect(s.multiplier).toBeCloseTo(1.3);
    expect(s.perDay['2026-10-15'].multiplier).toBeCloseTo(1.2);
    const gap = computeStats({ ...base, sessions, activities: [], today: '2026-10-17' });
    expect(gap.streak).toBe(0);
    expect(gap.maxStreak).toBe(3);
  });
  it('активный день: ≥5 минут практики или 1 дубль, 4 минуты — нет', () => {
    const d = '2026-10-14';
    const a4 = computeStats({ ...base, sessions: [], activities: [act(d, 'drill', 'x-unknown', 240)], today: d });
    expect(a4.perDay[d].active).toBe(false);
    expect(a4.streak).toBe(0);
    const a5 = computeStats({ ...base, sessions: [], activities: [act(d, 'drill', 'x-unknown', 300)], today: d });
    expect(a5.perDay[d].active).toBe(true);
    expect(a5.perDay[d].xp).toBe(15); // 10 + 5 за ≥5 мин
    const t = computeStats({ ...base, sessions: [], activities: [take(d, 't1', 20)], today: d });
    expect(t.perDay[d].active).toBe(true);
    expect(t.perDay[d].xp).toBe(15);
  });
  it('календарь: 56 дней до воскресенья текущей недели', () => {
    const d = '2026-10-14'; // среда
    const s = computeStats({ ...base, sessions: [], activities: [take(d, 't1', 20)], today: d });
    expect(s.calendar).toHaveLength(56);
    expect(s.calendar[55].date).toBe('2026-10-18');
    expect(s.calendar[0].date).toBe('2026-08-24');
    expect(s.calendar.find((c) => c.date === d)!.level).toBe(1);
    expect(s.calendar[55].level).toBe(0);
  });
});

describe('цель дня и бонусы', () => {
  it('цель дня: +20 XP при выполнении минут', () => {
    const d = '2026-10-14';
    const acts = [0, 1, 2, 3, 4].map((i) => act(d, 'ritual_step', String(i), 0));
    const s = computeStats({ sessions: [], activities: acts, takes: [], today: d, dailyGoalMin: 15 });
    expect(s.minutesToday).toBe(15);
    expect(s.perDay[d].goalMet).toBe(true);
    expect(s.perDay[d].xp).toBe(50 + 20);
    expect(s.calendar.find((c) => c.date === d)!.level).toBe(2);
    const harder = computeStats({ sessions: [], activities: acts, takes: [], today: d, dailyGoalMin: 16 });
    expect(harder.perDay[d].goalMet).toBe(false);
    expect(harder.perDay[d].xp).toBe(50);
  });
  it('бонус улучшения: дубль лучше предыдущего по fpm, по created_at', () => {
    const d = '2026-10-14';
    const acts = [
      take(d, 't3', 60, { fpm: 3 }, '09:00:00'),
      take(d, 't1', 60, { fpm: 6 }, '07:00:00'),
      take(d, 't2', 60, { fpm: 7 }, '08:00:00'), // хуже — без бонуса
    ];
    const s = computeStats({ sessions: [], activities: acts, takes: [], today: d, dailyGoalMin: 999 });
    expect(s.perDay[d].xp).toBe(3 * 15 + 10);
    expect(s.perDay[d].minutes).toBe(3);
  });
  it('бонус улучшения не даётся без fpm и между днями', () => {
    const acts = [take('2026-10-13', 'a', 60, { fpm: 6 }), take('2026-10-14', 'b', 60, { fpm: 1 }), take('2026-10-14', 'c', 60, {}, '09:00:00')];
    const s = computeStats({ sessions: [], activities: acts, takes: [], today: '2026-10-14', dailyGoalMin: 999 });
    expect(s.perDay['2026-10-14'].xp).toBe(Math.round(30 * 1.1));
  });
  it('упражнение из библиотеки: 10 XP, +5 при ≥5 минутах, время по номиналу', () => {
    const d = '2026-10-14';
    const s = computeStats({ sessions: [], activities: [act(d, 'drill', 'pace-metronome-130', 0)], takes: [], today: d, dailyGoalMin: 999 });
    expect(s.perDay[d].minutes).toBe(4);
    expect(s.perDay[d].xp).toBe(10);
    const long = computeStats({ sessions: [], activities: [act(d, 'drill', 'retell-podcast', 0)], takes: [], today: d, dailyGoalMin: 999 });
    expect(long.perDay[d].xp).toBe(15);
  });
  it('шаг не удваивается, если есть и в steps_done, и в activities', () => {
    const d = '2026-10-14';
    const s = computeStats({ sessions: [session(d, { steps_done: [0, 1] })], activities: [act(d, 'ritual_step', '0', 180)], takes: [], today: d, dailyGoalMin: 999 });
    expect(s.perDay[d].xp).toBe(20);
  });
});

describe('уровни', () => {
  it('11 уровней и пороги', () => {
    expect(LEVELS).toHaveLength(11);
    expect(levelFor(0)).toMatchObject({ index: 0, name: 'Новичок', next: { name: 'Разговорчивый', min: 150 } });
    expect(levelFor(149).index).toBe(0);
    expect(levelFor(150).index).toBe(1);
    expect(levelFor(799).index).toBe(2);
    expect(levelFor(10500)).toEqual({ index: 10, name: 'Легенда', min: 10500 });
  });
  it('открытия как в legacy', () => {
    expect([0, 1, 2, 3, 4, 5, 8].map(prepSecondsFor)).toEqual([30, 30, 20, 20, 10, 10, 10]);
    expect(unlocks(0).next).toMatchObject({ level: 3, text: 'подготовка сокращается до 20 сек' });
    expect(unlocks(3).next).toMatchObject({ level: 5 });
    expect(unlocks(4)).toMatchObject({ noPaper: true, surprise: false, prepSeconds: 10 });
    expect(unlocks(5).surprise).toBe(true);
    expect(unlocks(5).next).toBeNull();
  });
});

describe('достижения', () => {
  const codes = (input: Partial<StatsInput> & { today: string }) => {
    const full: StatsInput = { sessions: [], activities: [], takes: [], dailyGoalMin: 999, ...input };
    return checkAchievements(computeStats(full), full);
  };
  const saved = (d: string, p: Partial<Session> = {}) => session(d, { saved_at: d + 'T08:00:00Z', fillers: 5, ...p });

  it('список: 12 legacy + 6 новых', () => {
    expect(ACHIEVEMENTS.map((a) => a.id)).toEqual([
      'first', 's3', 's7', 's30', 'clean', 'clear', 'record', 'early', 'full5', 'ch10', 'week', 'lvl4',
      'micro', 'metronome', 'marathon', 'own_path', 'hunter', 'hour10',
    ]);
  });
  it('пустая история', () => {
    expect(codes({ today: '2026-10-14' })).toEqual([]);
  });
  it('first, clean, clear, early, record', () => {
    const c = codes({
      today: '2026-10-14',
      sessions: [saved('2026-10-13', { fillers: 4, clarity: 5, saved_hour: 8 }), saved('2026-10-14', { fillers: 0 })],
    });
    expect(c).toEqual(['first', 'clean', 'clear', 'record', 'early']);
  });
  it('серии по всей истории, даже если сейчас прервана; week', () => {
    const dates = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06', '2026-09-07'];
    const c = codes({ today: '2026-10-14', sessions: dates.map((d) => saved(d)) });
    expect(c).toContain('s3');
    expect(c).toContain('s7');
    expect(c).not.toContain('s30');
    expect(c).toContain('week');
    const weak = codes({ today: '2026-10-14', sessions: ['2026-09-01', '2026-09-02', '2026-09-04', '2026-09-05'].map((d) => saved(d)) });
    expect(weak).not.toContain('week');
    expect(weak).not.toContain('s3');
  });
  it('full5, ch10, lvl4', () => {
    const sessions = Array.from({ length: 12 }, (_, i) => saved(`2026-09-${String(i + 1).padStart(2, '0')}`, { full: i < 5, challenge_done: true, steps_done: [0, 1, 2, 3, 4] }));
    const c = codes({ today: '2026-09-12', sessions });
    expect(c).toEqual(expect.arrayContaining(['full5', 'ch10', 'lvl4', 'week', 's7']));
  });
  it('micro: 10 разобранных дублей', () => {
    const takes = Array.from({ length: 10 }, (_, i) => ({ id: `t${i}`, status: 'done', session_date: '2026-10-14', metrics: null, feedback: null }) as unknown as TakeSummary);
    expect(codes({ today: '2026-10-14', takes })).toContain('micro');
    expect(codes({ today: '2026-10-14', takes: takes.slice(0, 9) })).not.toContain('micro');
  });
  it('metronome: 3 календарных дня темп 120–150', () => {
    const mk = (d: string, wpm: number) => take(d, 't' + d, 60, { wpm, fpm: 2 });
    expect(codes({ today: '2026-10-14', activities: [mk('2026-10-12', 130), mk('2026-10-13', 150), mk('2026-10-14', 120)] })).toContain('metronome');
    expect(codes({ today: '2026-10-14', activities: [mk('2026-10-12', 130), mk('2026-10-13', 151), mk('2026-10-14', 120)] })).not.toContain('metronome');
    expect(codes({ today: '2026-10-14', activities: [mk('2026-10-11', 130), mk('2026-10-13', 140), mk('2026-10-14', 120)] })).not.toContain('metronome');
  });
  it('marathon, hour10', () => {
    expect(codes({ today: '2026-10-14', activities: [act('2026-10-14', 'drill', 'x', 3600)] })).toContain('marathon');
    expect(codes({ today: '2026-10-14', activities: [act('2026-10-14', 'drill', 'x', 3540)] })).not.toContain('marathon');
    const hours = Array.from({ length: 10 }, (_, i) => act(`2026-09-${String(i + 1).padStart(2, '0')}`, 'drill', 'x', 3600));
    expect(codes({ today: '2026-10-14', activities: hours })).toContain('hour10');
  });
  it('own_path: 5 упражнений из плана', () => {
    const plan = (n: number) => Array.from({ length: n }, (_, i) => act('2026-10-14', 'drill', 'x' + i, 100, { plan: true }));
    expect(codes({ today: '2026-10-14', activities: plan(5) })).toContain('own_path');
    expect(codes({ today: '2026-10-14', activities: plan(4) })).not.toContain('own_path');
  });
  it('hunter: паразиты/мин за последние 7 дней вдвое ниже, чем за первые 7', () => {
    const t = (d: string, fpm: number) => take(d, 't' + d, 60, { fpm });
    const first = [t('2026-09-01', 8), t('2026-09-03', 6)];
    expect(codes({ today: '2026-10-14', activities: [...first, t('2026-10-10', 3.5), t('2026-10-14', 3)] })).toContain('hunter');
    expect(codes({ today: '2026-10-14', activities: [...first, t('2026-10-10', 5), t('2026-10-14', 4)] })).not.toContain('hunter');
    // окна пересекаются — рано
    expect(codes({ today: '2026-09-05', activities: [...first, t('2026-09-05', 1)] })).not.toContain('hunter');
  });
});
