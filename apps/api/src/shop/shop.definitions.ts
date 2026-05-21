export type ShopItemKind = 'frame' | 'font';

export interface ShopItemDef {
  id: string;
  kind: ShopItemKind;
  title: string;
  description: string;
  price: number;
  /** Дополнительные данные товара, специфичные для kind.
   *  Для frame – цвет CSS. Для font – ключ шрифта ('alegreya'/'manrope'). */
  meta?: Record<string, string>;
}

export const SHOP_ITEMS: ShopItemDef[] = [
  {
    id: 'frame_blue',
    kind: 'frame',
    title: 'Синяя рамка',
    description: 'Декоративная синяя рамка вокруг аватара',
    price: 2,
    meta: { color: '#3b82f6' },
  },
  {
    id: 'frame_green',
    kind: 'frame',
    title: 'Зелёная рамка',
    description: 'Декоративная зелёная рамка вокруг аватара',
    price: 2,
    meta: { color: '#22c55e' },
  },
  {
    id: 'frame_red',
    kind: 'frame',
    title: 'Красная рамка',
    description: 'Декоративная красная рамка вокруг аватара',
    price: 2,
    meta: { color: '#ef4444' },
  },
  {
    id: 'frame_yellow',
    kind: 'frame',
    title: 'Жёлтая рамка',
    description: 'Декоративная жёлтая рамка вокруг аватара',
    price: 2,
    meta: { color: '#eab308' },
  },

  // ── Шрифты ─────────────────────────────────────────────────
  {
    id: 'font_alegreya',
    kind: 'font',
    title: 'Alegreya Sans',
    description: 'Гуманистичный sans-serif с характером. Применяется ко всему интерфейсу и видна другим на вашем профиле.',
    price: 3,
    meta: { key: 'alegreya' },
  },
  {
    id: 'font_manrope',
    kind: 'font',
    title: 'Manrope',
    description: 'Современный геометричный sans-serif. Применяется ко всему интерфейсу и видна другим на вашем профиле.',
    price: 3,
    meta: { key: 'manrope' },
  },
];

export const SHOP_ITEM_MAP = new Map<string, ShopItemDef>(
  SHOP_ITEMS.map((i) => [i.id, i]),
);
