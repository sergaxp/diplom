import { api, tokens } from './api';

export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  location: string | null;
  locationLat: number | null;
  locationLon: number | null;
  showGlobalEvents: boolean;
  showHolidays: boolean;
  role: 'user' | 'admin';
  isEmailVerified: boolean;
  createdAt: string;
  xp?: number;
  coins?: number;
  selectedFrame?: string | null;
  selectedFont?: string | null;
  socialLinks?: Record<string, string> | null;
}

export interface AuthResult {
  user: User;
  tokens: { accessToken: string; refreshToken: string };
}

export const authApi = {
  register: (body: { username: string; email: string; password: string }) =>
    api.post<AuthResult>('/auth/register', body).then((r) => r.data),

  login: (body: { identifier: string; password: string }) =>
    api.post<AuthResult>('/auth/login', body).then((r) => r.data),

  // /users/me возвращает полный объект из БД (включая displayName, bio, avatarUrl)
  me: () =>
    api.get<User>('/users/me').then((r) => r.data),
};

export const saveAuth = (result: AuthResult) => {
  tokens.set(result.tokens.accessToken, result.tokens.refreshToken);
};

export const clearAuth = () => {
  tokens.clear();
};

export const hasToken = () => tokens.getAccess() !== null;
