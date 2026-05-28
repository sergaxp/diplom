import { create } from 'zustand';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  init: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'light',
  init() {
    const saved = localStorage.getItem('theme') as Theme | null;
    const theme = saved ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },
  toggle() {
    const next: Theme = get().theme === 'light' ? 'dark' : 'light';
    const root = document.documentElement;
    // Включаем плавный кроссфейд цветов на время переключения темы.
    root.classList.add('theme-transition');
    root.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    set({ theme: next });
    window.setTimeout(() => root.classList.remove('theme-transition'), 300);
  },
}));
