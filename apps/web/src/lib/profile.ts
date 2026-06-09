import { api, tokens } from './api';
import { User } from './auth';
import { ShowcaseBlock } from './showcases';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface PublicProfile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  backgroundUrl: string | null;
  bio: string | null;
  location: string | null;
  createdAt: string;
  xp: number;
  coins?: number;
  level: number;
  selectedFrame?: string | null;
  selectedBackground?: string | null;
  socialLinks?: Record<string, string> | null;
  showcases?: ShowcaseBlock[] | null;
}

export interface UpdateProfilePayload {
  displayName?: string;
  username?: string;
  bio?: string;
  location?: string;
  locationLat?: number;
  locationLon?: number;
  showGlobalEvents?: boolean;
  showHolidays?: boolean;
  selectedFrame?: string | null;
  selectedBackground?: string | null;
  socialLinks?: Record<string, string> | null;
  showcases?: ShowcaseBlock[] | null;
}

export const profileApi = {
  update: (data: UpdateProfilePayload): Promise<User> =>
    api.patch<User>('/users/me', data).then(r => r.data),

  uploadAvatar: async (file: File): Promise<User> => {
    const formData = new FormData();
    formData.append('file', file);
    const token = tokens.getAccess();
    const res = await fetch(`${API_URL}/users/me/avatar`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: 'Ошибка загрузки' }));
      throw { response: { data: body } };
    }
    return res.json();
  },

  uploadCover: async (file: File): Promise<User> => {
    const formData = new FormData();
    formData.append('file', file);
    const token = tokens.getAccess();
    const res = await fetch(`${API_URL}/users/me/cover`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: 'Ошибка загрузки' }));
      throw { response: { data: body } };
    }
    return res.json();
  },

  uploadBackground: async (file: File): Promise<User> => {
    const formData = new FormData();
    formData.append('file', file);
    const token = tokens.getAccess();
    const res = await fetch(`${API_URL}/users/me/background`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: 'Ошибка загрузки' }));
      throw { response: { data: body } };
    }
    return res.json();
  },

  deleteAvatar: (): Promise<User> =>
    api.delete<User>('/users/me/avatar').then(r => r.data),

  deleteCover: (): Promise<User> =>
    api.delete<User>('/users/me/cover').then(r => r.data),

  deleteBackground: (): Promise<User> =>
    api.delete<User>('/users/me/background').then(r => r.data),

  getPublic: (username: string): Promise<PublicProfile> =>
    api.get<PublicProfile>(`/users/${username}`).then(r => r.data),

  changePassword: (data: { currentPassword: string; newPassword: string }): Promise<void> =>
    api.patch('/users/me/password', data).then(() => undefined),

  changeEmail: (data: { newEmail: string; password: string }): Promise<User> =>
    api.patch<User>('/users/me/email', data).then(r => r.data),

  deleteAccount: (password: string): Promise<void> =>
    api.delete('/users/me', { data: { password } }).then(() => undefined),
};
