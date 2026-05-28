'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { AxiosError } from 'axios';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { authApi, saveAuth } from '../../lib/auth';
import { useAuthStore } from '../../store/authStore';
import { Button, Input } from '../../components/ui';
import styles from './page.module.scss';

// ── Схемы валидации ───────────────────────────────────────────
const loginSchema = z.object({
  identifier: z.string().min(1, 'Введите логин или email'),
  password:   z.string().min(8, 'Минимум 8 символов'),
});

const registerSchema = z
  .object({
    username: z.string()
      .min(3, 'Минимум 3 символа')
      .max(32, 'Максимум 32 символа')
      .regex(/^[a-zA-Z0-9_-]+$/, 'Только буквы, цифры, _ и -'),
    email:           z.string().email('Некорректный email'),
    password:        z.string().min(8, 'Минимум 8 символов').max(72),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  });

type LoginForm    = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

function ServerError({ message }: { message: string }) {
  return (
    <div className={styles.serverError} role="alert">
      <AlertCircle size={16} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

export default function AuthPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [serverError, setServerError] = useState('');
  const router  = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const ready   = useAuthStore((s) => s.ready);
  const user    = useAuthStore((s) => s.user);

  useEffect(() => {
    if (ready && user) router.replace('/');
  }, [ready, user, router]);

  const {
    register: regLogin,
    handleSubmit: submitLogin,
    formState: { errors: loginErrors },
    reset: resetLogin,
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const loginMut = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => { saveAuth(data); setUser(data.user); router.push('/'); },
    onError: (e: AxiosError<{ message: string }>) =>
      setServerError(e.response?.data?.message ?? 'Неверный логин или пароль'),
  });

  const {
    register: regRegister,
    handleSubmit: submitRegister,
    formState: { errors: registerErrors },
    reset: resetRegister,
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const registerMut = useMutation({
    mutationFn: ({ username, email, password }: RegisterForm) =>
      authApi.register({ username, email, password }),
    onSuccess: (data) => { saveAuth(data); setUser(data.user); router.push('/'); },
    onError: (e: AxiosError<{ message: string }>) =>
      setServerError(e.response?.data?.message ?? 'Ошибка регистрации'),
  });

  const switchTab = (t: typeof tab) => {
    setTab(t); setServerError('');
    resetLogin(); resetRegister();
  };

  return (
    <div className={styles.root}>
      <div className={styles.grain} aria-hidden />

      <Link href="/" className={styles.logo}>WT</Link>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h1 className={styles.cardTitle}>
            {tab === 'login' ? 'Добро пожаловать' : 'Создать аккаунт'}
          </h1>
          <p className={styles.cardSubtitle}>
            {tab === 'login'
              ? 'Войди в своё личное пространство'
              : 'Один аккаунт — весь функционал сайта'}
          </p>
        </div>

        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'login'}
            className={[styles.tab, tab === 'login' ? styles.tabActive : ''].join(' ')}
            onClick={() => switchTab('login')}
          >Вход</button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'register'}
            className={[styles.tab, tab === 'register' ? styles.tabActive : ''].join(' ')}
            onClick={() => switchTab('register')}
          >Регистрация</button>
        </div>

        {serverError && <ServerError message={serverError} />}

        {tab === 'login' && (
          <form
            className={styles.form}
            onSubmit={submitLogin((v) => { setServerError(''); loginMut.mutate(v); })}
            noValidate
          >
            <Input
              label="Логин или email"
              type="text"
              placeholder="sergey или sergey@example.com"
              autoComplete="username"
              error={loginErrors.identifier?.message}
              {...regLogin('identifier')}
            />
            <Input
              label="Пароль"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              error={loginErrors.password?.message}
              {...regLogin('password')}
            />
            <Button type="submit" variant="accent" size="lg" fullWidth loading={loginMut.isPending}>
              Войти
            </Button>
            <p className={styles.hint}>
              Нет аккаунта?{' '}
              <button type="button" className={styles.hintLink} onClick={() => switchTab('register')}>
                Зарегистрироваться
              </button>
            </p>
          </form>
        )}

        {tab === 'register' && (
          <form
            className={styles.form}
            onSubmit={submitRegister((v) => { setServerError(''); registerMut.mutate(v); })}
            noValidate
          >
            <Input
              label="Логин"
              type="text"
              placeholder="только буквы, цифры, _ и -"
              autoComplete="username"
              error={registerErrors.username?.message}
              {...regRegister('username')}
            />
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              error={registerErrors.email?.message}
              {...regRegister('email')}
            />
            <Input
              label="Пароль"
              type="password"
              placeholder="минимум 8 символов"
              autoComplete="new-password"
              error={registerErrors.password?.message}
              {...regRegister('password')}
            />
            <Input
              label="Повтор пароля"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              error={registerErrors.confirmPassword?.message}
              {...regRegister('confirmPassword')}
            />
            <Button type="submit" variant="accent" size="lg" fullWidth loading={registerMut.isPending}>
              Создать аккаунт
            </Button>
            <p className={styles.hint}>
              Уже есть аккаунт?{' '}
              <button type="button" className={styles.hintLink} onClick={() => switchTab('login')}>
                Войти
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
