'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { AxiosError } from 'axios';
import Link from 'next/link';
import { authApi, saveAuth, hasToken } from '../../lib/auth';
import { useAuthStore } from '../../store/authStore';
import styles from './page.module.scss';

// ── Схемы валидации ───────────────────────────────────────────
const loginSchema = z.object({
  identifier: z.string().min(1, 'Введите логин или email'),
  password:   z.string().min(8, 'Минимум 8 символов'),
});

const registerSchema = z
  .object({
    username:        z.string()
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

// ── Компонент поля ────────────────────────────────────────────
function Field({
  label,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      <input
        className={[styles.input, error ? styles.inputError : ''].join(' ')}
        {...props}
      />
      {error && <p className={styles.fieldError}>{error}</p>}
    </div>
  );
}

// ── Компонент ошибки ──────────────────────────────────────────
function ServerError({ message }: { message: string }) {
  return (
    <div className={styles.serverError} role="alert">
      <span className={styles.errorIcon}>!</span>
      {message}
    </div>
  );
}

// ── Главный компонент ─────────────────────────────────────────
export default function AuthPage() {
  const [tab, setTab]               = useState<'login' | 'register'>('login');
  const [serverError, setServerError] = useState('');
  const router  = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const ready   = useAuthStore((s) => s.ready);
  const user    = useAuthStore((s) => s.user);

  // Если уже залогинен — редирект на главную
  useEffect(() => {
    if (ready && user) router.replace('/');
  }, [ready, user, router]);

  // ── Форма входа ───────────────────────────────────────────
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

  // ── Форма регистрации ─────────────────────────────────────
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
      <div className={styles.grain}  aria-hidden />
      <div className={styles.blob1}  aria-hidden />
      <div className={styles.blob2}  aria-hidden />

      <Link href="/" className={styles.logo}>WT</Link>

      <div className={styles.card}>
        {/* Заголовок */}
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

        {/* Вкладки */}
        <div className={styles.tabs}>
          <button
            type="button"
            className={[styles.tab, tab === 'login'    ? styles.tabActive : ''].join(' ')}
            onClick={() => switchTab('login')}
          >Вход</button>
          <button
            type="button"
            className={[styles.tab, tab === 'register' ? styles.tabActive : ''].join(' ')}
            onClick={() => switchTab('register')}
          >Регистрация</button>
        </div>

        {serverError && <ServerError message={serverError} />}

        {/* Форма входа */}
        {tab === 'login' && (
          <form
            className={styles.form}
            onSubmit={submitLogin((v) => { setServerError(''); loginMut.mutate(v); })}
            noValidate
          >
            <Field
              label="Логин или email"
              type="text"
              placeholder="sergey или sergey@example.com"
              autoComplete="username"
              error={loginErrors.identifier?.message}
              {...regLogin('identifier')}
            />
            <Field
              label="Пароль"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              error={loginErrors.password?.message}
              {...regLogin('password')}
            />
            <button type="submit" className={styles.submitBtn} disabled={loginMut.isPending}>
              {loginMut.isPending ? <span className={styles.spinner} /> : 'Войти'}
            </button>
            <p className={styles.hint}>
              Нет аккаунта?{' '}
              <button type="button" className={styles.hintLink} onClick={() => switchTab('register')}>
                Зарегистрироваться
              </button>
            </p>
          </form>
        )}

        {/* Форма регистрации */}
        {tab === 'register' && (
          <form
            className={styles.form}
            onSubmit={submitRegister((v) => { setServerError(''); registerMut.mutate(v); })}
            noValidate
          >
            <Field
              label="Логин"
              type="text"
              placeholder="только буквы, цифры, _ и -"
              autoComplete="username"
              error={registerErrors.username?.message}
              {...regRegister('username')}
            />
            <Field
              label="Email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              error={registerErrors.email?.message}
              {...regRegister('email')}
            />
            <Field
              label="Пароль"
              type="password"
              placeholder="минимум 8 символов"
              autoComplete="new-password"
              error={registerErrors.password?.message}
              {...regRegister('password')}
            />
            <Field
              label="Повтор пароля"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              error={registerErrors.confirmPassword?.message}
              {...regRegister('confirmPassword')}
            />
            <button type="submit" className={styles.submitBtn} disabled={registerMut.isPending}>
              {registerMut.isPending ? <span className={styles.spinner} /> : 'Создать аккаунт'}
            </button>
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
