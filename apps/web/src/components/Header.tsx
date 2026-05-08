'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../store/authStore';
import { clearAuth } from '../lib/auth';
import styles from './Header.module.scss';

const navLinks = [
  { label: 'Manager', href: '/manager' },
  { label: 'Mail',    href: '/mail' },
  { label: 'Lists',   href: '/lists' },
  { label: 'Docs',    href: '/docs' },
  { label: 'Stuff',   href: '/stuff' },
  { label: 'Tunel',   href: '/tunel' },
];

export function Header() {
  const { user, ready } = useAuthStore();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Закрываем меню при клике вне
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

  // Первая буква имени пользователя для аватара-заглушки
  const initial = user?.displayName?.[0] ?? user?.username?.[0] ?? '?';

  return (
    <header className={styles.header}>
      <Link href="/" className={styles.logo}>WT</Link>

      <nav className={styles.nav}>
        {navLinks.map((l) => (
          <Link key={l.href} href={l.href} className={styles.navLink}>
            {l.label}
          </Link>
        ))}
      </nav>

      <div className={styles.right}>
        {/* Пока auth не инициализирован — ничего не рендерим чтобы не было прыжка */}
        {ready && (
          user ? (
            // ── Залогинен ──────────────────────────────────────
            <div className={styles.avatarWrap} ref={menuRef}>
              <button
                className={styles.avatarBtn}
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Меню пользователя"
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.username}
                    className={styles.avatarImg}
                  />
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
                  <Link href={`/u/${user.username}`} className={styles.dropdownItem} onClick={() => setMenuOpen(false)}>
                    Профиль
                  </Link>
                  <Link href="/manager" className={styles.dropdownItem} onClick={() => setMenuOpen(false)}>
                    Manager
                  </Link>
                  <Link href="/mail" className={styles.dropdownItem} onClick={() => setMenuOpen(false)}>
                    Mail
                  </Link>
                  <div className={styles.dropdownDivider} />
                  <button className={styles.dropdownLogout} onClick={handleLogout}>
                    Выйти
                  </button>
                </div>
              )}
            </div>
          ) : (
            // ── Не залогинен ───────────────────────────────────
            <Link href="/auth" className={styles.loginBtn}>
              Войти
            </Link>
          )
        )}
      </div>
    </header>
  );
}
