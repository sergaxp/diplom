import { api } from './api';

export type NotificationKind = 'achievement' | 'task_completed' | 'daily_bonus' | 'purchase';

export interface NotificationItem {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  icon: string | null;
  color: string | null;
  read: boolean;
  createdAt: string;
}

export const notificationsApi = {
  list: (): Promise<NotificationItem[]> =>
    api.get<NotificationItem[]>('/notifications').then(r => r.data),

  unreadCount: (): Promise<number> =>
    api.get<{ count: number }>('/notifications/unread-count').then(r => r.data.count),

  markRead: (id: string): Promise<void> =>
    api.post(`/notifications/${id}/read`).then(() => undefined),

  markAllRead: (): Promise<void> =>
    api.post('/notifications/read-all').then(() => undefined),

  remove: (id: string): Promise<void> =>
    api.delete(`/notifications/${id}`).then(() => undefined),

  clearAll: (): Promise<void> =>
    api.delete('/notifications').then(() => undefined),
};
