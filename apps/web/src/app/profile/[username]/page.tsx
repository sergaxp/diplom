'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Header } from '../../../components/Header';
import { profileApi } from '../../../lib/profile';
import { useAuthStore } from '../../../store/authStore';
import styles from './page.module.scss';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

export default function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  const { user: me } = useAuthStore();

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['profile', username],
    queryFn: () => profileApi.getPublic(username),
  });

  const isOwn = me?.username === username;
  const initial = profile
    ? (profile.displayName ?? profile.username)[0].toUpperCase()
    : '?';

  return (
    <div className={styles.root}>
      <Header />

      {isLoading && (
        <div className={styles.state}>Загрузка...</div>
      )}

      {isError && (
        <div className={styles.state}>Пользователь не найден</div>
      )}

      {profile && (
        <div className={styles.body}>
          <div className={styles.banner} />

          <div className={styles.content}>
            <div className={styles.avatarWrap}>
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.username} className={styles.avatarImg} />
              ) : (
                <span className={styles.avatarInitial}>{initial}</span>
              )}
            </div>

            <div className={styles.info}>
              <div className={styles.names}>
                <span className={styles.displayName}>
                  {profile.displayName ?? profile.username}
                </span>
                <span className={styles.username}>@{profile.username}</span>
              </div>

              {profile.bio && (
                <p className={styles.bio}>{profile.bio}</p>
              )}

              <div className={styles.meta}>
                Участник с {formatDate(profile.createdAt)}
              </div>

              {isOwn && (
                <Link href="/settings" className={styles.editBtn}>
                  Редактировать профиль
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
