'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { authApi, hasToken, clearAuth } from '../lib/auth';
import { useAuthStore } from '../store/authStore';

function AuthInitializer() {
  const { setUser, setReady } = useAuthStore();

  useEffect(() => {
    if (!hasToken()) {
      setReady();
      return;
    }
    // Токен есть — загружаем пользователя
    authApi
      .me()
      .then((user) => setUser(user))
      .catch(() => {
        // Токен невалидный — чистим
        clearAuth();
        setReady();
      });
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
    </QueryClientProvider>
  );
}
