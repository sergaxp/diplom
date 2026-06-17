'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import {
  User as UserIcon, Shield, Settings as SettingsIcon, Palette, Tags as TagsIcon,
} from 'lucide-react';
import { Header } from '../../components/Header';
import { AvatarFramed } from '../../components/AvatarFramed';
import { useAuthStore } from '../../store/authStore';
import { useAchievementStore } from '../../store/achievementStore';
import { usePageTitle } from '../../hooks/useTabTitle';
import { clearAuth, authApi } from '../../lib/auth';
import { api } from '../../lib/api';
import type { AchievementResult } from '../../lib/achievements';
import { fadeInUp } from '../../lib/motion';
import { TabId } from './types';
import { ProfileTab } from './tabs/ProfileTab';
import { AccountTab } from './tabs/account/AccountTab';
import { ManagerTab } from './tabs/ManagerTab';
import { AppearanceTab } from './tabs/AppearanceTab';
import { TagsTab } from './tabs/TagsTab';
import styles from './page.module.scss';

const NAV_GROUPS: { title: string; items: { id: TabId; label: string; icon: React.ReactNode }[] }[] = [
  {
    title: 'Настройки пользователя',
    items: [
      { id: 'account',    label: 'Моя учётная запись', icon: <Shield size={16} strokeWidth={1.75} /> },
      { id: 'profile',    label: 'Профиль',            icon: <UserIcon size={16} strokeWidth={1.75} /> },
      { id: 'appearance', label: 'Внешний вид',        icon: <Palette size={16} strokeWidth={1.75} /> },
    ],
  },
  {
    title: 'Приложение',
    items: [
      { id: 'manager', label: 'Менеджер', icon: <SettingsIcon size={16} strokeWidth={1.75} /> },
      { id: 'tags',    label: 'Теги',     icon: <TagsIcon size={16} strokeWidth={1.75} /> },
    ],
  },
];

export default function SettingsPage() {
  const { user, ready, setUser, logout } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  usePageTitle('Настройки');

  const [tab, setTab] = useState<TabId>('profile');
  const pushAchievement = useAchievementStore(s => s.push);

  useEffect(() => {
    if (ready && !user) router.replace('/auth');
  }, [ready, user, router]);

  // Достижение «Настройщик» — фиксируем факт открытия страницы настроек.
  useEffect(() => {
    if (!ready || !user) return;
    let cancelled = false;
    api
      .post<{ newAchievements?: AchievementResult[] }>('/users/me/settings-opened')
      .then(async (res) => {
        const earned = res.data.newAchievements ?? [];
        if (cancelled || earned.length === 0) return;
        earned.forEach(pushAchievement);
        qc.invalidateQueries({ queryKey: ['achievements'] });
        const fresh = await authApi.me().catch(() => null);
        if (fresh && !cancelled) setUser(fresh);
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // Выполняем один раз после готовности авторизации.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user?.id]);

  if (!ready || !user) return null;

  return (
    <div className={styles.root}>
      <Header />
      <div className={styles.body}>
        <div className={styles.layout}>
          <aside className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
              <AvatarFramed
                avatarUrl={user.avatarUrl}
                displayName={user.displayName}
                username={user.username}
                frameId={user.selectedFrame}
                size={48}
              />
              <div className={styles.sidebarUser}>
                <span className={styles.sidebarName}>{user.displayName ?? user.username}</span>
                <button type="button" className={styles.sidebarEditLink} onClick={() => setTab('profile')}>
                  Редактировать профиль
                </button>
              </div>
            </div>

            <nav className={styles.navList}>
              {NAV_GROUPS.map(group => (
                <div key={group.title} className={styles.navGroup}>
                  <span className={styles.navGroupTitle}>{group.title}</span>
                  {group.items.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      className={[styles.navItem, tab === t.id ? styles.navItemActive : ''].join(' ')}
                      onClick={() => setTab(t.id)}
                      aria-current={tab === t.id ? 'page' : undefined}
                    >
                      <span className={styles.navIcon}>{t.icon}</span>
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              ))}
            </nav>

            <div className={styles.sidebarFooter}>
              <Link href={`/u/${user.username}`} className={styles.sidebarLink}>
                ← Вернуться в профиль
              </Link>
            </div>
          </aside>

          <main className={styles.content}>
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                {tab === 'profile'    && <ProfileTab    user={user} setUser={setUser} />}
                {tab === 'account'    && <AccountTab    user={user} setUser={setUser} onDeleted={() => { logout(); clearAuth(); router.replace('/welcome'); }} />}
                {tab === 'manager'    && <ManagerTab    user={user} setUser={setUser} />}
                {tab === 'appearance' && <AppearanceTab user={user} setUser={setUser} />}
                {tab === 'tags'       && <TagsTab user={user} qc={qc} />}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}
