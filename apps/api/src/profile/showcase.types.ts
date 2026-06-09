/**
 * Конфигурация витрин профиля (Steam-style showcases).
 * Хранится JSON-массивом в users.showcases; порядок = порядок блоков на странице.
 * Зеркало этого типа живёт на фронте в apps/web/src/lib/showcases.ts.
 */

export type ShowcaseType = 'stats' | 'favorites' | 'featuredPosts';

export interface ShowcaseBlock {
  /** Сгенерированный на клиенте id (для ключей и переупорядочивания) */
  id: string;
  type: ShowcaseType;
  /** Произвольные настройки блока:
   *  - favorites: { itemIds: string[] } — id рамок/предметов магазина
   *  - featuredPosts: { postIds: string[] } — закреплённые посты
   *  - stats: {} — собирается автоматически */
  settings: Record<string, unknown>;
}
