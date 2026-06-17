/**
 * Типы событий журнала активности. Зеркало этого union живёт на фронте в
 * apps/web/src/lib/activity.ts (иконки/цвета ленты).
 */
export type ActivityType =
  | 'task_created'
  | 'task_completed'
  | 'task_reopened'
  | 'task_updated'
  | 'task_moved'
  | 'task_deleted'
  | 'project_created';

export interface LogActivityInput {
  userId: string;
  projectId?: string | null;
  taskId?: string | null;
  type: ActivityType;
  summary: string;
  meta?: Record<string, string> | null;
}

/** Кол-во событий за конкретный день (YYYY-MM-DD) — клетка heatmap. */
export interface DayCount {
  date: string;
  count: number;
}

/**
 * Разбор query-параметров периода heatmap. По умолчанию — последние 365 дней
 * (как у GitHub). `from`/`to` — даты YYYY-MM-DD.
 */
export function activityRange(
  from?: string,
  to?: string,
): { fromDate: Date; toDate: Date } {
  const toDate = to ? new Date(`${to}T23:59:59.999Z`) : new Date();
  const fromDate = from
    ? new Date(`${from}T00:00:00.000Z`)
    : new Date(toDate.getTime() - 365 * 24 * 60 * 60 * 1000);
  return { fromDate, toDate };
}
