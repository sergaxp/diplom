import { api } from './api';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: 'user' | 'admin';
  isActive: boolean;
  createdAt: string;
  lastSeenAt: string | null;
}

export interface GlobalTask {
  id: string;
  title: string;
  description: string | null;
  date: string;
  time: string | null;
  repeat: string;
  repeatUntil: string | null;
  icon: string | null;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalTasks: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const adminApi = {
  promote: async (username: string, secret: string): Promise<AdminUser> => {
    const res = await fetch(`${API_URL}/admin/promote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body: JSON.stringify({ username }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message ?? 'Ошибка');
    }
    return res.json();
  },

  getStats: (): Promise<AdminStats> =>
    api.get<AdminStats>('/admin/stats').then(r => r.data),

  getUsers: (search?: string): Promise<AdminUser[]> =>
    api.get<AdminUser[]>('/admin/users', { params: search ? { search } : {} }).then(r => r.data),

  updateUser: (id: string, data: { role?: string; isActive?: boolean }): Promise<AdminUser> =>
    api.patch<AdminUser>(`/admin/users/${id}`, data).then(r => r.data),

  deleteUser: (id: string): Promise<void> =>
    api.delete(`/admin/users/${id}`).then(() => undefined),

  getGlobalTasks: (): Promise<GlobalTask[]> =>
    api.get<GlobalTask[]>('/admin/events').then(r => r.data),

  createGlobalTask: (data: Omit<GlobalTask, 'id' | 'createdAt'>): Promise<GlobalTask> =>
    api.post<GlobalTask>('/admin/events', data).then(r => r.data),

  deleteGlobalTask: (id: string): Promise<void> =>
    api.delete(`/admin/events/${id}`).then(() => undefined),
};
