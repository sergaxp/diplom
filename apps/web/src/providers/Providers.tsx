'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { useEffect, useState } from 'react';
import { authApi, hasToken, clearAuth } from '../lib/auth';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { api } from '../lib/api';
import { AchievementToast } from '../components/AchievementToast';
import { LevelUpCelebration } from '../components/LevelUpCelebration';

const PING_INTERVAL = 2 * 60 * 1000; // 2 минуты

function AuthInitializer() {
  const { setUser, setReady } = useAuthStore();

  const pingAndRefresh = async () => {
    try {
      const res = await api.post<{ dailyBonusGranted?: boolean }>('/users/me/ping');
      if (res.data?.dailyBonusGranted) {
        // Подтягиваем свежие coins после начисления ежедневного бонуса
        const fresh = await authApi.me().catch(() => null);
        if (fresh) setUser(fresh);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!hasToken()) {
      setReady();
      return;
    }
    authApi
      .me()
      .then((user) => {
        setUser(user);
        pingAndRefresh();
      })
      .catch(() => {
        clearAuth();
        setReady();
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!hasToken()) return;
    const id = setInterval(() => {
      if (hasToken()) pingAndRefresh();
    }, PING_INTERVAL);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

function ThemeInitializer() {
  const { init } = useThemeStore();
  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}


export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {/* reducedMotion="user" — все framer-анимации уважают
          prefers-reduced-motion: трансформы гасятся, остаётся лишь opacity. */}
      <MotionConfig reducedMotion="user">
        <ThemeInitializer />
        <AuthInitializer />
        {children}
        <AchievementToast />
        <LevelUpCelebration />
      </MotionConfig>
    </QueryClientProvider>
  );
}
