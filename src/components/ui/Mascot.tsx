import type { CSSProperties } from 'react';

export type Mood = 'happy' | 'think' | 'wow' | 'cheer' | 'sleep' | 'coach' | 'sad';

const INK = 'var(--ink-line)';
const S = { stroke: INK, strokeWidth: 3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

/** Мик — маскот: пухлый микрофон с чернильной обводкой. */
export function Mascot({ mood = 'happy', size = 96, bob = false, style }: { mood?: Mood; size?: number; bob?: boolean; style?: CSSProperties }) {
  const armsUp = mood === 'cheer';
  return (
    <svg
      viewBox="0 0 120 140"
      width={size}
      height={(size * 140) / 120}
      role="img"
      aria-label="Мик"
      style={{ overflow: 'visible', animation: bob ? 'bob 2.6s ease-in-out infinite' : undefined, ...style }}
    >
      <defs>
        <pattern id="mik-mesh" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0H7M0 0V7" stroke="#6f66a8" strokeWidth="1.6" />
        </pattern>
      </defs>
      {/* ноги */}
      <ellipse cx="46" cy="130" rx="11" ry="7" fill="#3a83e6" {...S} />
      <ellipse cx="74" cy="130" rx="11" ry="7" fill="#3a83e6" {...S} />
      {/* руки */}
      {armsUp ? (
        <>
          <path d="M28 84 Q14 66 18 50" fill="none" {...S} strokeWidth={9} stroke={INK} />
          <path d="M28 84 Q14 66 18 50" fill="none" stroke="#4d9dff" strokeWidth={5} strokeLinecap="round" />
          <path d="M92 84 Q106 66 102 50" fill="none" {...S} strokeWidth={9} stroke={INK} />
          <path d="M92 84 Q106 66 102 50" fill="none" stroke="#4d9dff" strokeWidth={5} strokeLinecap="round" />
        </>
      ) : mood === 'coach' ? (
        <>
          <path d="M28 92 Q16 100 20 110" fill="none" stroke={INK} strokeWidth={9} strokeLinecap="round" />
          <path d="M28 92 Q16 100 20 110" fill="none" stroke="#4d9dff" strokeWidth={5} strokeLinecap="round" />
          <path d="M92 88 Q106 78 104 62" fill="none" stroke={INK} strokeWidth={9} strokeLinecap="round" />
          <path d="M92 88 Q106 78 104 62" fill="none" stroke="#4d9dff" strokeWidth={5} strokeLinecap="round" />
          <path d="M104 62 L104 52" stroke={INK} strokeWidth={7} strokeLinecap="round" />
          <path d="M104 62 L104 52" stroke="#4d9dff" strokeWidth={3} strokeLinecap="round" />
        </>
      ) : mood === 'think' ? (
        <>
          <path d="M28 92 Q16 100 20 110" fill="none" stroke={INK} strokeWidth={9} strokeLinecap="round" />
          <path d="M28 92 Q16 100 20 110" fill="none" stroke="#4d9dff" strokeWidth={5} strokeLinecap="round" />
          <path d="M92 104 Q86 112 72 110" fill="none" stroke={INK} strokeWidth={9} strokeLinecap="round" />
          <path d="M92 104 Q86 112 72 110" fill="none" stroke="#4d9dff" strokeWidth={5} strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M28 92 Q16 100 20 110" fill="none" stroke={INK} strokeWidth={9} strokeLinecap="round" />
          <path d="M28 92 Q16 100 20 110" fill="none" stroke="#4d9dff" strokeWidth={5} strokeLinecap="round" />
          <path d="M92 92 Q104 100 100 110" fill="none" stroke={INK} strokeWidth={9} strokeLinecap="round" />
          <path d="M92 92 Q104 100 100 110" fill="none" stroke="#4d9dff" strokeWidth={5} strokeLinecap="round" />
        </>
      )}
      {/* тело */}
      <rect x="26" y="56" width="68" height="70" rx="30" fill="#4d9dff" {...S} />
      <path d="M36 70 Q36 62 44 60" fill="none" stroke="#9cc8ff" strokeWidth="4" strokeLinecap="round" />
      {/* сетка-купол */}
      <path d="M22 54 A38 38 0 0 1 98 54 Z" fill="#2b2550" {...S} />
      <path d="M22 54 A38 38 0 0 1 98 54 Z" fill="url(#mik-mesh)" />
      <rect x="20" y="50" width="80" height="13" rx="6.5" fill="#ffb938" {...S} />
      {/* лицо */}
      <Face mood={mood} />
      {mood === 'sleep' && (
        <g fill={INK} fontFamily="var(--display)" fontWeight="800">
          <text x="98" y="30" fontSize="14">z</text>
          <text x="108" y="18" fontSize="10">z</text>
        </g>
      )}
      {mood === 'think' && (
        <g>
          <circle cx="104" cy="30" r="4" fill="var(--surface)" stroke={INK} strokeWidth="2" />
          <circle cx="112" cy="16" r="6" fill="var(--surface)" stroke={INK} strokeWidth="2" />
        </g>
      )}
    </svg>
  );
}

function Eye({ x, y, look = [0, 0] }: { x: number; y: number; look?: [number, number] }) {
  return (
    <g>
      <circle cx={x} cy={y} r="8.5" fill="#fff" stroke={INK} strokeWidth="2.5" />
      <circle cx={x + look[0]} cy={y + look[1]} r="4.6" fill={INK} />
      <circle cx={x + look[0] + 1.6} cy={y + look[1] - 1.8} r="1.6" fill="#fff" />
    </g>
  );
}

function Face({ mood }: { mood: Mood }) {
  const cheeks = (
    <>
      <ellipse cx="38" cy="98" rx="5" ry="3.2" fill="#ff8fb0" opacity="0.75" />
      <ellipse cx="82" cy="98" rx="5" ry="3.2" fill="#ff8fb0" opacity="0.75" />
    </>
  );
  switch (mood) {
    case 'cheer':
      return (
        <g>
          <path d="M40 86 Q47 78 54 86" fill="none" {...S} />
          <path d="M66 86 Q73 78 80 86" fill="none" {...S} />
          <path d="M46 96 Q60 116 74 96 Z" fill="#7a1f3d" {...S} />
          <path d="M53 104 Q60 110 67 104" fill="#ff7a9a" />
          {cheeks}
        </g>
      );
    case 'sleep':
      return (
        <g>
          <path d="M40 87 Q47 92 54 87" fill="none" {...S} />
          <path d="M66 87 Q73 92 80 87" fill="none" {...S} />
          <ellipse cx="60" cy="103" rx="4" ry="3" fill="#7a1f3d" {...S} strokeWidth={2} />
          {cheeks}
        </g>
      );
    case 'wow':
      return (
        <g>
          <path d="M38 72 Q45 68 52 71" fill="none" {...S} strokeWidth={2.5} />
          <path d="M68 71 Q75 68 82 72" fill="none" {...S} strokeWidth={2.5} />
          <Eye x={46} y={84} />
          <Eye x={74} y={84} />
          <ellipse cx="60" cy="104" rx="6" ry="7" fill="#7a1f3d" {...S} />
          {cheeks}
        </g>
      );
    case 'think':
      return (
        <g>
          <path d="M38 73 Q45 70 52 74" fill="none" {...S} strokeWidth={2.5} />
          <path d="M68 70 Q75 67 82 70" fill="none" {...S} strokeWidth={2.5} />
          <Eye x={46} y={84} look={[2.5, -2.5]} />
          <Eye x={74} y={84} look={[2.5, -2.5]} />
          <path d="M54 104 Q60 101 67 103" fill="none" {...S} />
          {cheeks}
        </g>
      );
    case 'sad':
      return (
        <g>
          <path d="M38 74 Q45 72 52 70" fill="none" {...S} strokeWidth={2.5} />
          <path d="M68 70 Q75 72 82 74" fill="none" {...S} strokeWidth={2.5} />
          <Eye x={46} y={85} look={[0, 2]} />
          <Eye x={74} y={85} look={[0, 2]} />
          <path d="M51 106 Q60 99 69 106" fill="none" {...S} />
        </g>
      );
    case 'coach':
      return (
        <g>
          <path d="M38 73 Q45 71 52 73" fill="none" {...S} strokeWidth={2.5} />
          <path d="M68 70 Q75 66 82 69" fill="none" {...S} strokeWidth={2.5} />
          <Eye x={46} y={84} look={[1.5, 0]} />
          <Eye x={74} y={84} look={[1.5, 0]} />
          <path d="M50 100 Q62 110 72 99" fill="none" {...S} />
          {cheeks}
        </g>
      );
    default:
      return (
        <g>
          <Eye x={46} y={84} />
          <Eye x={74} y={84} />
          <path d="M48 98 Q60 114 72 98 Z" fill="#7a1f3d" {...S} />
          <path d="M54 105 Q60 109 66 105" fill="#ff7a9a" />
          {cheeks}
        </g>
      );
  }
}
