import type { Metadata } from 'next';
import { Alegreya_Sans, Manrope } from 'next/font/google';
import { Providers } from '../providers/Providers';
import '../styles/globals.scss';

const alegreya = Alegreya_Sans({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-alegreya',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Warmingtea – твоё личное пространство',
  description: 'Менеджер задач, почта, списки и многое другое.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning className={[alegreya.variable, manrope.variable].join(' ')}>
      <head>
        {/* Предотвращаем "вспышку" неправильной темы и шрифта при загрузке */}
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
