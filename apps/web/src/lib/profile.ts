import { api, tokens } from './api';
import { User } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface PublicProfile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  createdAt: string;
  xp: number;
  level: number;
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

  getPublic: (username: string): Promise<PublicProfile> =>
    api.get<PublicProfile>(`/users/${username}`).then(r => r.data),
};
