export type ShopItemKind = 'frame' | 'background';

export interface ShopItemDef {
  id: string;
  kind: ShopItemKind;
  title: string;
  description: string;
  price: number;
  /** Дополнительные данные товара, специфичные для kind.
   *  Для frame – цвет CSS (meta.color).
   *  Для background – CSS-градиент (meta.gradient) или видео (meta.video) и
   *  флаг анимации (meta.animated='1'). */
  meta?: Record<string, string>;
}

// Ценовые тиры (в монетах). Монеты копятся за достижения (1–4) и daily-вход (+1).
const P_FRAME = 3; // рамки аватара
const P_BG = 5; // статичный градиент-фон
const P_BG_ANIM = 8; // анимированный градиент-фон
const P_BG_STEAM = 10; // анимированный фон

// База Steam CDN для анимированных фонов профиля (публично хотлинкаемые .webm)
const STEAM =
  'https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/items';

export const SHOP_ITEMS: ShopItemDef[] = [
  {
    id: 'frame_blue',
    kind: 'frame',
    title: 'Синяя рамка',
    description: 'Декоративная синяя рамка вокруг аватара',
    price: P_FRAME,
    meta: { color: '#3b82f6' },
  },
  {
    id: 'frame_green',
    kind: 'frame',
    title: 'Зелёная рамка',
    description: 'Декоративная зелёная рамка вокруг аватара',
    price: P_FRAME,
    meta: { color: '#22c55e' },
  },
  {
    id: 'frame_red',
    kind: 'frame',
    title: 'Красная рамка',
    description: 'Декоративная красная рамка вокруг аватара',
    price: P_FRAME,
    meta: { color: '#ef4444' },
  },
  {
    id: 'frame_yellow',
    kind: 'frame',
    title: 'Жёлтая рамка',
    description: 'Декоративная жёлтая рамка вокруг аватара',
    price: P_FRAME,
    meta: { color: '#eab308' },
  },

  // ── Фоны-градиенты ──
  {
    id: 'bg_meadow',
    kind: 'background',
    title: 'Хвойный лес',
    description: 'Спокойный зелёный градиент на фон профиля',
    price: P_BG,
    meta: { gradient: 'linear-gradient(135deg, #1b4332, #2d6a4f, #40916c)' },
  },
  {
    id: 'bg_dusk',
    kind: 'background',
    title: 'Сумерки',
    description: 'Мягкий сиренево-серый градиент',
    price: P_BG,
    meta: { gradient: 'linear-gradient(135deg, #2b2d42, #4a4e69, #9a8c98)' },
  },
  {
    id: 'bg_aurora',
    kind: 'background',
    title: 'Северное сияние',
    description: 'Анимированный переливающийся градиент',
    price: P_BG_ANIM,
    meta: {
      gradient: 'linear-gradient(120deg, #0f2027, #203a43, #2c5364, #1d976c)',
      animated: '1',
    },
  },
  {
    id: 'bg_nebula',
    kind: 'background',
    title: 'Туманность',
    description: 'Анимированный космический градиент',
    price: P_BG_ANIM,
    meta: {
      gradient: 'linear-gradient(120deg, #3a1c71, #d76d77, #ffaf7b, #d76d77)',
      animated: '1',
    },
  },

  // ── Анимированные фоны  (.webm с CDN Steam) ──
  {
    id: 'bg_steam_starry',
    kind: 'background',
    title: 'Звёздная ночь',
    description: 'Анимированный фон ',
    price: P_BG_STEAM,
    meta: {
      video: `${STEAM}/570/982491acceb6c9dde0d5e49dab1e7540c5faa1de.webm`,
      animated: '1',
    },
  },
  {
    id: 'bg_steam_deepsea',
    kind: 'background',
    title: 'Глубокое море',
    description: 'Анимированный фон ',
    price: P_BG_STEAM,
    meta: {
      video: `${STEAM}/1263950/6c0a7998c55d09d6c69677a5b7c7002125d66024.webm`,
      animated: '1',
    },
  },
  {
    id: 'bg_steam_oceanside',
    kind: 'background',
    title: 'Океан',
    description: 'Анимированный фон ',
    price: P_BG_STEAM,
    meta: {
      video: `${STEAM}/1263950/f23886b58f6060646bd1442e0e639c91c229c1d6.webm`,
      animated: '1',
    },
  },
  {
    id: 'bg_steam_jelly',
    kind: 'background',
    title: 'Медузы',
    description: 'Анимированный фон ',
    price: P_BG_STEAM,
    meta: {
      video: `${STEAM}/1263950/cba7f6ad5a2a96638ff91e5900e17fa671d0385e.webm`,
      animated: '1',
    },
  },
  {
    id: 'bg_steam_blackhole',
    kind: 'background',
    title: 'Чёрная дыра',
    description: 'Анимированный фон ',
    price: P_BG_STEAM,
    meta: {
      video: `${STEAM}/1263950/4d466f77edf3265a253fba79d47bc91a37e34920.webm`,
      animated: '1',
    },
  },
  {
    id: 'bg_steam_marbles',
    kind: 'background',
    title: 'Шарики',
    description: 'Анимированный фон ',
    price: P_BG_STEAM,
    meta: {
      video: `${STEAM}/1263950/f5a81e23cd49ad90be88d31c136e9fed35e9aa6a.webm`,
      animated: '1',
    },
  },
  {
    id: 'bg_steam_autumn',
    kind: 'background',
    title: 'Осенние листья',
    description: 'Анимированный фон ',
    price: P_BG_STEAM,
    meta: {
      video: `${STEAM}/1465660/6f0c3c0d89b37e1d0fbdd805f114eb359dc0e539.webm`,
      animated: '1',
    },
  },
  {
    id: 'bg_steam_bedroom',
    kind: 'background',
    title: 'Уютная комната',
    description: 'Анимированный фон ',
    price: P_BG_STEAM,
    meta: {
      video: `${STEAM}/1263950/9394e4bf0c98d266e30520853a74c084e12293e0.webm`,
      animated: '1',
    },
  },
  {
    id: 'bg_steam_spiral',
    kind: 'background',
    title: 'Спираль',
    description: 'Анимированный фон ',
    price: P_BG_STEAM,
    meta: {
      video: `${STEAM}/870780/1af21138c5e8288994da820c4361d4551debc404.webm`,
      animated: '1',
    },
  },
];

export const SHOP_ITEM_MAP = new Map<string, ShopItemDef>(
  SHOP_ITEMS.map((i) => [i.id, i]),
);
