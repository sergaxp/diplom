import { api } from './api';

export type AchievementRank = 1 | 2 | 3 | 4;

export const RANK_LABEL: Record<AchievementRank, string> = {
  1: 'Обычное',
  2: 'Редкое',
  3: 'Эпическое',
  4: 'Легендарное',
};

// Цвета рангов из дизайн-системы (природная палитра северного леса).
// Источник: md/warmingtea-design-system.md §2.3
export const RANK_COLOR: Record<AchievementRank, string> = {
  1: '#8EA69B', // Туман      — Обычное
  2: '#B04E6E', // Брусника   — Редкое
  3: '#7A4288', // Слива      — Эпическое
  4: '#D4A83C', // Янтарь     — Легендарное
};

// Текстовые цвета для текста ПОВЕРХ фона ранга (контраст ≥ 4.5:1)
export const RANK_TEXT_ON_BG: Record<AchievementRank, string> = {
  1: '#1A3028',
  2: '#FAF3E8',
  3: '#FAF3E8',
  4: '#3A2804',
};

export interface AchievementResult {
  id: string;
  title: string;
  description: string;
  rank: AchievementRank;
  xp: number;
  icon: string;
  secret?: boolean;
  /** id достижений-предков в дереве навыков (пусто — корень). */
  requires: string[];
  unlocked: boolean;
  unlockedAt?: string;
}

// Монеты за разблокировку достижения соответствующего ранга (зеркало backend RANK_COINS).
export const RANK_COINS: Record<AchievementRank, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
};

export const achievementsApi = {
  getAll: (): Promise<AchievementResult[]> =>
    api.get<AchievementResult[]>('/achievements').then(r => r.data),
};
