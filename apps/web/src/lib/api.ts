import axios, { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ── Токены ────────────────────────────────────────────────────
export const tokens = {
  getAccess:  () => (typeof window !== 'undefined' ? localStorage.getItem('wt_access')  : null),
  getRefresh: () => (typeof window !== 'undefined' ? localStorage.getItem('wt_refresh') : null),
  set(access: string, refresh: string) {
    localStorage.setItem('wt_access', access);
    localStorage.setItem('wt_refresh', refresh);
  },
  clear() {
    localStorage.removeItem('wt_access');
    localStorage.removeItem('wt_refresh');
  },
};

// ── Добавляем токен к каждому запросу ─────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokens.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // FormData: браузер сам выставит multipart/form-data с boundary
  if (config.data instanceof FormData) {
    if (config.headers instanceof AxiosHeaders) {
      config.headers.delete('Content-Type');
    } else {
      delete (config.headers as Record<string, unknown>)['Content-Type'];
    }
  }
  return config;
});

// ── Автоматическое обновление токена при 401 ─────────────────
let refreshing = false;
let queue: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = [];

const flush = (err: unknown, token?: string) => {
  queue.forEach((p) => (err ? p.reject(err) : p.resolve(token!)));
  queue = [];
};

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const orig = err.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (err.response?.status !== 401 || orig._retry) return Promise.reject(err);

    const refresh = tokens.getRefresh();
    if (!refresh) {
      tokens.clear();
      return Promise.reject(err);
    }

    if (refreshing) {
      return new Promise((resolve, reject) => queue.push({ resolve, reject })).then(
        (t) => { orig.headers.Authorization = `Bearer ${t}`; return api(orig); },
      );
    }

    orig._retry = true;
    refreshing = true;

    try {
      const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken: refresh });
      tokens.set(data.accessToken, data.refreshToken);
      flush(null, data.accessToken);
      orig.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(orig);
    } catch (e) {
      flush(e);
      tokens.clear();
      return Promise.reject(e);
    } finally {
      refreshing = false;
    }
  },
);
