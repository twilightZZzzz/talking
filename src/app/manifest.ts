import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Утренняя речь',
    short_name: 'Речь',
    description: 'Тренажёр речи с разбором от ИИ',
    start_url: '/',
    display: 'standalone',
    background_color: '#fff6ea',
    theme_color: '#fff6ea',
    lang: 'ru',
    icons: [
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
