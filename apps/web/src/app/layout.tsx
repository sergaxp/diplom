import type { Metadata, Viewport } from 'next';
import { Onest, Unbounded } from 'next/font/google';
import { Providers } from '../providers/Providers';
import '../styles/globals.scss';

const onest = Onest({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600'],
  variable: '--font-onest',
  display: 'swap',
});

// Дисплейный шрифт бренда: заголовки, hero, логотип
const unbounded = Unbounded({
  subsets: ['latin', 'cyrillic'],
  weight: ['500', '600', '700'],
  variable: '--font-unbounded',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Warmingtea – твоё личное пространство',
  description: 'Менеджер задач, почта, списки и многое другое.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Warmingtea',
    statusBarStyle: 'default',
  },
  icons: {
    // Логотип-сова во вкладке: SVG для современных браузеров +
    // PNG-фоллбэк для тех, кто не рисует SVG-favicon (иначе серый квадрат).
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#1F4A40',
  // Раскрываем контент под вырезы/жесты, чтобы работали env(safe-area-inset-*)
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${onest.variable} ${unbounded.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme')||(window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
