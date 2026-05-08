import { api, tokens } from './api';

export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: 'user' | 'admin';
  isEmailVerified: boolean;
  createdAt: string;
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

  me: () =>
    api.get<{ user: User }>('/auth/me').then((r) => r.data.user),
};

export const saveAuth = (result: AuthResult) => {
  tokens.set(result.tokens.accessToken, result.tokens.refreshToken);
};

export const clearAuth = () => {
  tokens.clear();
};

export const hasToken = () => tokens.getAccess() !== null;
