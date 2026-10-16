/** Прогресс «звуковой волной»: столбики разной высоты, заполненные слева направо. */
const H = [0.55, 0.8, 0.45, 1, 0.65, 0.9, 0.5, 0.75, 0.6, 0.95, 0.5, 0.7, 0.85, 0.55, 0.9, 0.65, 0.8, 0.5, 1, 0.6];

export function Wave({
  value,
  bars = 20,
  height = 26,
  color = 'var(--mint)',
  label,
}: {
  value: number; // 0..1
  bars?: number;
  height?: number;
  color?: string;
  label?: string;
}) {
  const on = Math.round(Math.max(0, Math.min(1, value)) * bars);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      aria-label={label}
      style={{ display: 'flex', alignItems: 'center', gap: 3, height }}
    >
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          style={{
            flex: 1,
            height: `${H[i % H.length] * 100}%`,
            borderRadius: 4,
            background: i < on ? color : 'var(--line)',
            transition: 'background .3s',
            transitionDelay: `${i * 25}ms`,
          }}
        />
      ))}
    </div>
  );
}

/** Обычная полоса прогресса со стикерной обводкой */
export function Bar({ value, color = 'var(--sun)', height = 14 }: { value: number; color?: string; height?: number }) {
  return (
    <div style={{ height, borderRadius: height, border: '2px solid var(--ink-line)', background: 'var(--bg-2)', overflow: 'hidden' }}>
      <div
        style={{
          height: '100%',
          width: `${Math.max(0, Math.min(1, value)) * 100}%`,
          background: color,
          borderRight: value > 0 && value < 1 ? '2px solid var(--ink-line)' : undefined,
          transition: 'width .6s ease',
        }}
      />
    </div>
  );
}
