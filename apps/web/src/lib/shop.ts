import { api } from './api';
import { User } from './auth';

export type ShopItemKind = 'frame' | 'background';

export interface ShopItem {
  id: string;
  kind: ShopItemKind;
  title: string;
  description: string;
  price: number;
  owned: boolean;
  meta?: Record<string, string>;
}

export interface BuyResult {
  user: User;
  itemId: string;
}

export const shopApi = {
  getItems: (): Promise<ShopItem[]> =>
    api.get<ShopItem[]>('/shop/items').then((r) => r.data),

  buy: (itemId: string): Promise<BuyResult> =>
    api.post<BuyResult>(`/shop/buy/${itemId}`).then((r) => r.data),
};

/** Цвет рамки по её ID – для отрисовки на фронте без обращения к API. */
export const FRAME_COLORS: Record<string, string> = {
  frame_blue:   '#3b82f6',
  frame_green:  '#22c55e',
  frame_red:    '#ef4444',
  frame_yellow: '#eab308',
};

/** Человекочитаемые названия рамок – для витрины «Любимые рамки». */
export const FRAME_LABELS: Record<string, string> = {
  frame_blue:   'Синяя рамка',
  frame_green:  'Зелёная рамка',
  frame_red:    'Красная рамка',
  frame_yellow: 'Жёлтая рамка',
};

export function getFrameColor(id: string | null | undefined): string | null {
  if (!id) return null;
  return FRAME_COLORS[id] ?? null;
}

/**
 * Реестр фонов профиля — зеркало meta из apps/api/src/shop/shop.definitions.ts.
 * Нужен, чтобы отрисовать выбранный фон на публичном профиле без обращения к
 * /shop/items (он требует авторизации). ВРЕМЕННО: градиенты для теста.
 */
export interface BackgroundStyle {
  /** CSS-градиент (background-image) */
  gradient?: string;
  /** URL картинки-фона */
  image?: string;
  /** URL видео-фона (.webm/.mp4) */
  video?: string;
  animated?: boolean;
}

const STEAM = 'https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/items';

export const BACKGROUND_STYLES: Record<string, BackgroundStyle> = {
  // градиенты
  bg_meadow: { gradient: 'linear-gradient(135deg, #1b4332, #2d6a4f, #40916c)' },
  bg_dusk:   { gradient: 'linear-gradient(135deg, #2b2d42, #4a4e69, #9a8c98)' },
  bg_aurora: { gradient: 'linear-gradient(120deg, #0f2027, #203a43, #2c5364, #1d976c)', animated: true },
  bg_nebula: { gradient: 'linear-gradient(120deg, #3a1c71, #d76d77, #ffaf7b, #d76d77)', animated: true },
  // анимированные фоны из Steam
  bg_steam_starry:    { video: `${STEAM}/570/982491acceb6c9dde0d5e49dab1e7540c5faa1de.webm`, animated: true },
  bg_steam_deepsea:   { video: `${STEAM}/1263950/6c0a7998c55d09d6c69677a5b7c7002125d66024.webm`, animated: true },
  bg_steam_oceanside: { video: `${STEAM}/1263950/f23886b58f6060646bd1442e0e639c91c229c1d6.webm`, animated: true },
  bg_steam_jelly:     { video: `${STEAM}/1263950/cba7f6ad5a2a96638ff91e5900e17fa671d0385e.webm`, animated: true },
  bg_steam_blackhole: { video: `${STEAM}/1263950/4d466f77edf3265a253fba79d47bc91a37e34920.webm`, animated: true },
  bg_steam_marbles:   { video: `${STEAM}/1263950/f5a81e23cd49ad90be88d31c136e9fed35e9aa6a.webm`, animated: true },
  bg_steam_autumn:    { video: `${STEAM}/1465660/6f0c3c0d89b37e1d0fbdd805f114eb359dc0e539.webm`, animated: true },
  bg_steam_bedroom:   { video: `${STEAM}/1263950/9394e4bf0c98d266e30520853a74c084e12293e0.webm`, animated: true },
  bg_steam_spiral:    { video: `${STEAM}/870780/1af21138c5e8288994da820c4361d4551debc404.webm`, animated: true },
};

export function getBackgroundStyle(
  id: string | null | undefined,
): BackgroundStyle | null {
  if (!id) return null;
  return BACKGROUND_STYLES[id] ?? null;
}
