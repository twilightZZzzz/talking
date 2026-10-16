import { addDays, weekStart } from '../calendar';
import type { Stats, StatsInput } from './calc';

export const ACHIEVEMENTS: { id: string; title: string; desc: string }[] = [
  { id: 'first', title: 'Первое слово', desc: 'Сохранить первый день' },
  { id: 's3', title: 'Разогрев', desc: 'Серия 3 дня' },
  { id: 's7', title: 'Неделя без пропусков', desc: 'Серия 7 дней' },
  { id: 's30', title: 'Месяц речи', desc: 'Серия 30 дней' },
  { id: 'clean', title: 'Чистая минута', desc: 'Дубль без единого паразита' },
  { id: 'clear', title: 'Ясно как день', desc: 'Ясность 5 из 5' },
  { id: 'record', title: 'Новый рекорд', desc: 'Побить рекорд по паразитам' },
  { id: 'early', title: 'Ранняя пташка', desc: 'Сохранить ритуал до 9:00' },
  { id: 'full5', title: 'Полный цикл', desc: '5 полных утренних ритуалов' },
  { id: 'ch10', title: 'Охотник за челленджами', desc: '10 выполненных челленджей' },
  { id: 'week', title: 'Цель недели', desc: '5 дней за одну неделю' },
  { id: 'lvl4', title: 'Чёткий', desc: 'Дойти до 4 уровня' },
  { id: 'micro', title: 'Под микроскопом', desc: 'Разобрать 10 дублей' },
  { id: 'metronome', title: 'Метроном', desc: 'Темп 120–150 слов в минуту три дня подряд' },
  { id: 'marathon', title: 'Марафонец', desc: '60 минут практики за один день' },
  { id: 'own_path', title: 'Своя дорога', desc: '5 упражнений из персонального плана' },
  { id: 'hunter', title: 'Охотник на паразитов', desc: 'Паразитов в минуту вдвое меньше, чем в начале' },
  { id: 'hour10', title: '10 часов речи', desc: 'Суммарно 600 минут практики' },
];

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Коды достижений, условия которых выполнены по всей истории. Открытые не снимаются — это решает вызывающий. */
export function checkAchievements(stats: Stats, input: StatsInput): string[] {
  const saved = input.sessions.filter((s) => s.saved_at);
  const takeActs = input.activities.filter((a) => a.kind === 'take');
  const doneTakes = input.takes.filter((t) => t.status === 'done');

  const weeks = new Map<string, number>();
  for (const [date, p] of Object.entries(stats.perDay)) {
    if (p.active) weeks.set(weekStart(date), (weeks.get(weekStart(date)) ?? 0) + 1);
  }

  const wpmDays = new Set(
    takeActs
      .filter((a) => typeof a.meta.wpm === 'number' && a.meta.wpm >= 120 && a.meta.wpm <= 150)
      .map((a) => a.date),
  );
  let metronome = false;
  for (const d of wpmDays) if (wpmDays.has(addDays(d, 1)) && wpmDays.has(addDays(d, 2))) metronome = true;

  const fpmTakes = takeActs.filter((a) => typeof a.meta.fpm === 'number');
  let hunter = false;
  if (fpmTakes.length) {
    const first = fpmTakes.map((a) => a.date).sort()[0];
    const firstEnd = addDays(first, 6);
    const lastStart = addDays(input.today, -6);
    if (firstEnd < lastStart) {
      const a = fpmTakes.filter((t) => t.date <= firstEnd).map((t) => t.meta.fpm as number);
      const b = fpmTakes.filter((t) => t.date >= lastStart && t.date <= input.today).map((t) => t.meta.fpm as number);
      hunter = a.length > 0 && b.length > 0 && avg(a) > 0 && avg(b) <= avg(a) * 0.5;
    }
  }

  const cond: Record<string, boolean> = {
    first: saved.length > 0,
    s3: stats.maxStreak >= 3,
    s7: stats.maxStreak >= 7,
    s30: stats.maxStreak >= 30,
    clean:
      saved.some((s) => s.fillers === 0) ||
      doneTakes.some((t) => t.metrics !== null && t.metrics.fillers_count === 0 && t.metrics.speech_s >= 30),
    clear: saved.some((s) => s.clarity === 5) || doneTakes.some((t) => t.feedback?.clarity === 5),
    record: stats.records > 0,
    early: saved.some((s) => s.saved_hour !== null && s.saved_hour < 9),
    full5: stats.fullCount >= 5,
    ch10: stats.challengeCount >= 10,
    week: [...weeks.values()].some((n) => n >= 5),
    lvl4: stats.level.index >= 3,
    micro: stats.takesAnalyzed >= 10,
    metronome,
    marathon: Object.values(stats.perDay).some((p) => p.minutes >= 60),
    own_path: input.activities.filter((a) => a.kind === 'drill' && a.meta.plan === true).length >= 5,
    hunter,
    hour10: stats.minutesTotal >= 600,
  };
  return ACHIEVEMENTS.filter((a) => cond[a.id]).map((a) => a.id);
}
