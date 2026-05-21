/**
 * Применение выбранного шрифта пользователя к корневому <html>.
 *
 * Источник правды — `User.selectedFont` с сервера (хранится в БД).
 * Этот хелпер только синхронизирует значение с `data-font` атрибутом.
 * Для гостей (не залогинен) — всегда системный.
 */

export type FontChoice = 'alegreya' | 'manrope' | null;

export function applyFont(font: string | null | undefined): void {
  if (typeof document === 'undefined') return;
  if (!font) {
    document.documentElement.removeAttribute('data-font');
  } else {
    document.documentElement.setAttribute('data-font', font);
  }
}
