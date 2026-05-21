/**
 * Каталог доступных шрифтов. Системный — бесплатный, остальные продаются
 * в магазине как товары с id `font_<key>` (см. apps/api/src/shop/shop.definitions.ts).
 *
 * Значение `key` хранится в `User.selectedFont` и проксируется в `<html data-font="...">`.
 * Сами шрифты подгружаются через next/font в `app/layout.tsx` и экспонируются
 * как CSS-переменные `--font-alegreya`, `--font-manrope`.
 */
export interface FontDef {
  /** Хранится в User.selectedFont (null = системный) */
  key: 'alegreya' | 'manrope';
  label: string;
  /** Соответствующий shop item id */
  shopItemId: string;
  /** CSS-источник для preview / inline-стилей. */
  cssFamily: string;
}

export const FONT_CATALOG: FontDef[] = [
  {
    key: 'alegreya',
    label: 'Alegreya Sans',
    shopItemId: 'font_alegreya',
    cssFamily: "var(--font-alegreya), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  {
    key: 'manrope',
    label: 'Manrope',
    shopItemId: 'font_manrope',
    cssFamily: "var(--font-manrope), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
];

export const SYSTEM_FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif";

export const FONT_MAP = new Map(FONT_CATALOG.map(f => [f.key, f]));

/** CSS-стек для конкретного `selectedFont`. null = системный. */
export function fontFamilyFor(key: string | null | undefined): string {
  if (!key) return SYSTEM_FONT_FAMILY;
  return FONT_MAP.get(key as FontDef['key'])?.cssFamily ?? SYSTEM_FONT_FAMILY;
}
