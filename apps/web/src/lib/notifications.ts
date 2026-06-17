import { api } from './api';
import type { CollabEntity } from './collab';

export type NotificationKind =
  | 'achievement'
  | 'task_completed'
  | 'daily_bonus'
  | 'purchase'
  | 'reminder'
  | 'collab_invite'
  | 'collab_accepted'
  | 'collab_comment';

export type NotificationActionState = 'pending' | 'accepted' | 'declined';

export interface NotificationData {
  entityType?: CollabEntity;
  entityId?: string;
  inviteId?: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  icon: string | null;
  color: string | null;
  read: boolean;
  data?: NotificationData | null;
  actionState?: NotificationActionState | null;
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
