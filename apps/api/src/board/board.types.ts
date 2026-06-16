/** Роль колонки доски. todo/doing/done — базовые; custom — пользовательские. */
export type BoardColumnRole = 'todo' | 'doing' | 'done' | 'custom';

export interface BoardColumn {
  id: string;
  name: string;
  role: BoardColumnRole;
  color?: string;
}

/** Базовая раскладка колонок (создаётся, если у пользователя ничего не сохранено). */
export const DEFAULT_BOARD_COLUMNS: BoardColumn[] = [
  { id: 'todo', name: 'Не начатые', role: 'todo', color: '#6B776F' },
  { id: 'doing', name: 'Начатые', role: 'doing', color: '#3B82F6' },
  { id: 'done', name: 'Завершённые', role: 'done', color: '#3E9C6D' },
];

/** 3 базовых + максимум 2 кастомных. */
export const MAX_BOARD_COLUMNS = 5;
