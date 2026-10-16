export const LEVELS: { name: string; min: number }[] = [
  { min: 0, name: 'Новичок' },
  { min: 150, name: 'Разговорчивый' },
  { min: 400, name: 'Собранный' },
  { min: 800, name: 'Чёткий' },
  { min: 1400, name: 'Уверенный' },
  { min: 2200, name: 'Спикер' },
  { min: 3200, name: 'Оратор' },
  { min: 4500, name: 'Голос эфира' },
  { min: 6000, name: 'Трибун' },
  { min: 8000, name: 'Мастер слова' },
  { min: 10500, name: 'Легенда' },
];

export interface LevelInfo {
  /** 0-based */
  index: number;
  name: string;
  min: number;
  next?: { index: number; name: string; min: number };
}

export function levelFor(xp: number): LevelInfo {
  let index = 0;
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i].min) index = i;
  const cur = LEVELS[index];
  const nx = LEVELS[index + 1];
  return {
    index,
    name: cur.name,
    min: cur.min,
    ...(nx ? { next: { index: index + 1, name: nx.name, min: nx.min } } : {}),
  };
}

/** Секунды на подготовку (legacy prepFor) */
export function prepSecondsFor(levelIndex: number): number {
  return levelIndex >= 4 ? 10 : levelIndex >= 2 ? 20 : 30;
}

export interface Unlocks {
  prepSeconds: number;
  /** режим «без бумажки» */
  noPaper: boolean;
  /** тема-сюрприз: открывается на старте таймера подготовки */
  surprise: boolean;
  /** ближайшее открытие; level — 1-based номер уровня для UI */
  next: { levelIndex: number; level: number; text: string } | null;
}

const UNLOCK_STEPS: [number, string][] = [
  [2, 'подготовка сокращается до 20 сек'],
  [4, 'режим «без бумажки», 10 сек'],
  [5, 'тема-сюрприз: узнаёшь её только на старте таймера'],
];

export function unlocks(levelIndex: number): Unlocks {
  const n = UNLOCK_STEPS.find(([l]) => levelIndex < l);
  return {
    prepSeconds: prepSecondsFor(levelIndex),
    noPaper: levelIndex >= 4,
    surprise: levelIndex >= 5,
    next: n ? { levelIndex: n[0], level: n[0] + 1, text: n[1] } : null,
  };
}
