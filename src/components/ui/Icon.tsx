import type { SVGProps } from 'react';

const P: Record<string, string> = {
  home: 'M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18',
  chart: 'M5 20V11M12 20V5M19 20v-6',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6',
  check: 'M5 12.5 10 17 19 7',
  x: 'M6 6l12 12M18 6 6 18',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z',
  play: 'M8 5v14l11-7z',
  stop: 'M7 7h10v10H7z',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
  upload: 'M12 16V4M7 9l5-5 5 5M5 20h14',
  flip: 'M4 8h11l-3-3M20 16H9l3 3',
  chevron: 'M9 6l6 6-6 6',
  back: 'M15 6l-6 6 6 6',
  plus: 'M12 5v14M5 12h14',
  wave: 'M3 12h2M7 8v8M11 5v14M15 9v6M19 7v10M21 12h0',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5',
  wind: 'M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z',
  pause: 'M8 5v14M16 5v14',
  gauge: 'M4 15a8 8 0 1 1 16 0M12 15l4-5',
  download: 'M12 4v12M7 11l5 5 5-5M5 20h14',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5h.01',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
};

export type IconName = keyof typeof P | 'flame' | 'bolt' | 'star' | 'trophy' | 'sun';

export function Icon({ name, size = 22, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true, ...rest };
  if (name === 'flame')
    return (
      <svg {...common}>
        <path d="M12 2c1 4 5.5 6 5.5 11.5a5.5 5.5 0 0 1-11 0c0-2.4 1.2-4 2.4-5 0 2 1 3.3 2.2 3.3C11 8.5 10 5.5 12 2z" fill="var(--coral)" stroke="var(--ink-line)" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M12 12c.8 1.6 2.4 2.4 2.4 4.2a2.4 2.4 0 0 1-4.8 0c0-1.3.9-2.3 2.4-4.2z" fill="var(--sun)" />
      </svg>
    );
  if (name === 'bolt')
    return (
      <svg {...common}>
        <path d="M13.5 2 5 13.5h6L10 22l9-12h-6z" fill="var(--sun)" stroke="var(--ink-line)" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    );
  if (name === 'star')
    return (
      <svg {...common}>
        <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill="var(--sun)" stroke="var(--ink-line)" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    );
  if (name === 'trophy')
    return (
      <svg {...common}>
        <path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 21h8" fill="var(--sun)" stroke="var(--ink-line)" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    );
  if (name === 'sun')
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4.5" fill="var(--sun)" stroke="var(--ink-line)" strokeWidth="1.8" />
        <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" stroke="var(--ink-line)" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg {...common} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d={P[name]} />
    </svg>
  );
}
