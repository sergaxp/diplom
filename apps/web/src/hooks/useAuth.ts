'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authApi, isAuthenticated } from '../lib/auth';
import { tokenStorage } from '../lib/api';
import { useAuthStore } from '../store/authStore';

export function useAuth() {
  const { user, isLoading, setUser, setLoading, clear } = useAuthStore();

  // Запрашиваем пользователя только если есть токен
  const { data, isError } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.getMe,
    enabled: isAuthenticated(),
    retry: false,
  });

  useEffect(() => {
    if (data) {
      setUser(data);
    }
  }, [data, setUser]);

  useEffect(() => {
    if (isError) {
      // Токен недействителен
      tokenStorage.clear();
      clear();
    }
  }, [isError, clear]);

  useEffect(() => {
    // Если токена нет вообще — сразу снимаем загрузку
    if (!isAuthenticated()) {
      setLoading(false);
    }
  }, [setLoading]);

  return { user, isLoading, isAuthenticated: !!user };
}
