import type { Metadata, Viewport } from 'next';
import { Onest, Unbounded } from 'next/font/google';
import './globals.css';

const unbounded = Unbounded({ variable: '--font-unbounded', subsets: ['cyrillic', 'latin'], weight: ['500', '700', '800'] });
const onest = Onest({ variable: '--font-onest', subsets: ['cyrillic', 'latin'], weight: ['400', '500', '600', '700'] });

export const metadata: Metadata = {
  title: 'Утренняя речь',
  description: 'Тренажёр речи с разбором от ИИ: каркас мысли, паузы вместо «э», персональный план.',
  applicationName: 'Утренняя речь',
  appleWebApp: { capable: true, title: 'Речь', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon.svg', apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fff6ea' },
    { media: '(prefers-color-scheme: dark)', color: '#16131f' },
  ],
};

// тема из прошлого визита — до гидратации, чтобы не мигало
const themeScript = `try{var t=localStorage.getItem('rech-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${unbounded.variable} ${onest.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
