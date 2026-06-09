import { api } from './api';

/** Зеркало apps/api/src/profile/showcase.types.ts */
export type ShowcaseType = 'stats' | 'favorites' | 'featuredPosts';

export interface ShowcaseBlock {
  id: string;
  type: ShowcaseType;
  settings: Record<string, unknown>;
}

export interface ProfileStats {
  level: number;
  xp: number;
  coins: number;
  postCount: number;
  achievementCount: number;
  achievementTotal: number;
}

export const SHOWCASE_LABELS: Record<ShowcaseType, string> = {
  stats: 'Статистика',
  favorites: 'Любимые рамки',
  featuredPosts: 'Избранные посты',
};

/** Сгенерировать пустой блок витрины указанного типа. */
export function newShowcaseBlock(type: ShowcaseType): ShowcaseBlock {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `sc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return { id, type, settings: {} };
}

export const showcaseApi = {
  getStats: (username: string): Promise<ProfileStats> =>
    api.get<ProfileStats>(`/profile/stats/${username}`).then((r) => r.data),

  getInventory: (username: string): Promise<string[]> =>
    api.get<string[]>(`/profile/inventory/${username}`).then((r) => r.data),
};
