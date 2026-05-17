'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sun, Moon } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { clearAuth } from '../lib/auth';
import styles from './Header.module.scss';

export function Header() {
  const { user, ready } = useAuthStore();
  const { theme, toggle } = useThemeStore();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    clearAuth();
    useAuthStore.getState().logout();
    setMenuOpen(false);
    router.push('/');
  };

  const initial = user?.displayName?.[0] ?? user?.username?.[0] ?? '?';

  return (
    <header className={styles.header}>
      <Link href="/manager" className={styles.logo}>WT</Link>
      <div className={styles.right}>
        <button
          className={`${styles.themeToggle}${theme === 'dark' ? ` ${styles.themeToggleDark}` : ''}`}
          onClick={toggle}
          aria-label="Переключить тему"
        >
          <Sun size={11} className={styles.themeIconSun} />
          <span className={styles.themeTrack}>
            <span className={styles.themeKnob} />
          </span>
          <Moon size={11} className={styles.themeIconMoon} />
        </button>

        {ready && (
          user ? (
            <div className={styles.avatarWrap} ref={menuRef}>
              <button
                className={styles.avatarBtn}
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Меню пользователя"
              >
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.username} className={styles.avatarImg} />
                ) : (
                  <span className={styles.avatarInitial}>{initial.toUpperCase()}</span>
                )}
              </button>

              {menuOpen && (
                <div className={styles.dropdown}>
                  <div className={styles.dropdownUser}>
                    <span className={styles.dropdownUsername}>@{user.username}</span>
                    <span className={styles.dropdownEmail}>{user.email}</span>
                  </div>
                  <div className={styles.dropdownDivider} />
                  <Link
                    href={`/profile/${user.username}`}
                    className={styles.dropdownLink}
                    onClick={() => setMenuOpen(false)}
                  >
                    Мой профиль
                  </Link>
                  <Link
                    href="/manager"
                    className={styles.dropdownLink}
                    onClick={() => setMenuOpen(false)}
                  >
                    Менеджер
                  </Link>
                  {user.role === 'admin' && (
                    <Link
                      href="/admin"
                      className={[styles.dropdownLink, styles.dropdownLinkAdmin].join(' ')}
                      onClick={() => setMenuOpen(false)}
                    >
                      Панель администратора
                    </Link>
                  )}
                  <Link
                    href="/settings"
                    className={styles.dropdownLink}
                    onClick={() => setMenuOpen(false)}
                  >
                    Настройки
                  </Link>
                  <div className={styles.dropdownDivider} />
                  <button className={styles.dropdownLogout} onClick={handleLogout}>
                    Выйти
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/auth" className={styles.loginBtn}>Войти</Link>
          )
        )}
      </div>
    </header>
  );
}
