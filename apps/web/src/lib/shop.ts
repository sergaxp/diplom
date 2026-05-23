import { api } from './api';
import { User } from './auth';

export type ShopItemKind = 'frame';

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

export function getFrameColor(id: string | null | undefined): string | null {
  if (!id) return null;
  return FRAME_COLORS[id] ?? null;
}
