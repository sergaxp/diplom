import { api } from './api';

export type AchievementRank = 1 | 2 | 3 | 4;

export const RANK_LABEL: Record<AchievementRank, string> = {
  1: 'Обычное',
  2: 'Редкое',
  3: 'Эпическое',
  4: 'Легендарное',
};

export const RANK_COLOR: Record<AchievementRank, string> = {
  1: '#9ca3af',
  2: '#3b82f6',
  3: '#8b5cf6',
  4: '#f59e0b',
};

export interface AchievementResult {
  id: string;
  title: string;
  description: string;
  rank: AchievementRank;
  xp: number;
  icon: string;
  secret?: boolean;
  unlocked: boolean;
  unlockedAt?: string;
}

export const achievementsApi = {
  getAll: (): Promise<AchievementResult[]> =>
    api.get<AchievementResult[]>('/achievements').then(r => r.data),
};
