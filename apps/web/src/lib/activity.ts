import { api } from './api';

/** Зеркало backend src/activity/activity.types.ts. */
export type ActivityType =
  | 'task_created'
  | 'task_completed'
  | 'task_reopened'
  | 'task_updated'
  | 'task_moved'
  | 'task_deleted'
  | 'project_created';

export interface ActivityEvent {
  id: string;
  userId: string;
  projectId: string | null;
  taskId: string | null;
  type: ActivityType;
  summary: string;
  meta?: Record<string, string> | null;
  createdAt: string;
}

/** Клетка heatmap — кол-во событий за день (YYYY-MM-DD). */
export interface DayCount {
  date: string;
  count: number;
}

export interface ProjectActivity {
  days: DayCount[];
  events: ActivityEvent[];
}

export const activityApi = {
  /** Активность проекта: клетки heatmap + лента событий. */
  getProjectActivity: (projectId: string): Promise<ProjectActivity> =>
    api.get<ProjectActivity>(`/projects/${projectId}/activity`).then((r) => r.data),

  /** Глобальные клетки heatmap пользователя (для витрины профиля). */
  getUserActivity: (username: string): Promise<{ days: DayCount[] }> =>
    api.get<{ days: DayCount[] }>(`/profile/activity/${username}`).then((r) => r.data),
};
