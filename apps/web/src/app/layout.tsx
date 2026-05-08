import type { Metadata } from 'next';
import { Providers } from '../providers/Providers';
import '../styles/globals.scss';

export const metadata: Metadata = {
  title: 'Warmingtea — твоё личное пространство',
  description: 'Менеджер задач, почта, списки и многое другое.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
