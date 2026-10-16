/** Солнце цели дня: диск наполняется, лучи загораются по мере минут практики. Перевыполнение — внешнее кольцо. */
export function SunGoal({ minutes, goal, size = 132 }: { minutes: number; goal: number; size?: number }) {
  const p = goal > 0 ? Math.min(1, minutes / goal) : 0;
  const over = goal > 0 ? Math.max(0, minutes / goal - 1) : 0;
  const rays = 12;
  const lit = Math.round(p * rays);
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={`Сегодня ${Math.round(minutes)} из ${goal} минут`}>
      {Array.from({ length: rays }, (_, i) => {
        const a = (i / rays) * Math.PI * 2 - Math.PI / 2;
        const x1 = 60 + Math.cos(a) * 46;
        const y1 = 60 + Math.sin(a) * 46;
        const x2 = 60 + Math.cos(a) * 56;
        const y2 = 60 + Math.sin(a) * 56;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={i < lit ? 'var(--sun)' : 'var(--line)'}
            strokeWidth="6"
            strokeLinecap="round"
            style={{ transition: 'stroke .4s', transitionDelay: `${i * 30}ms` }}
          />
        );
      })}
      <circle cx="60" cy="60" r="40" fill="var(--surface)" stroke="var(--ink-line)" strokeWidth="3" />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke="var(--sun-soft)"
        strokeWidth="9"
      />
      {p > 0 && <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke="var(--sun)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${c * p} ${c}`}
        transform="rotate(-90 60 60)"
        style={{ transition: 'stroke-dasharray .8s ease' }}
      />}
      {over > 0 && (
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="var(--coral)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${c * Math.min(1, over)} ${c}`}
          transform="rotate(-90 60 60)"
        />
      )}
      <text x="60" y="62" textAnchor="middle" fontFamily="var(--display)" fontWeight="800" fontSize="22" fill="var(--fg)">
        {Math.round(minutes)}
      </text>
      <text x="60" y="78" textAnchor="middle" fontFamily="var(--body)" fontWeight="700" fontSize="10" fill="var(--muted)">
        из {goal} мин
      </text>
    </svg>
  );
}
