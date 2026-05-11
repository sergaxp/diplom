'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { authApi, hasToken, clearAuth } from '../lib/auth';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import { AchievementToast } from '../components/AchievementToast';

const PING_INTERVAL = 2 * 60 * 1000; // 2 минуты

function AuthInitializer() {
  const { setUser, setReady } = useAuthStore();

  useEffect(() => {
    if (!hasToken()) {
      setReady();
      return;
    }
    authApi
      .me()
      .then((user) => {
        setUser(user);
        // Сразу фиксируем lastSeenAt
        api.post('/users/me/ping').catch(() => {});
      })
      .catch(() => {
        clearAuth();
        setReady();
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Периодический пинг пока пользователь на сайте
  useEffect(() => {
    if (!hasToken()) return;
    const id = setInterval(() => {
      if (hasToken()) api.post('/users/me/ping').catch(() => {});
    }, PING_INTERVAL);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer />
      {children}
      <AchievementToast />
    </QueryClientProvider>
  );
}
