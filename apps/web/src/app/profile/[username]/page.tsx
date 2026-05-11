'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import * as LucideIcons from 'lucide-react';
import { Header } from '../../../components/Header';
import { profileApi } from '../../../lib/profile';
import { achievementsApi, RANK_LABEL, RANK_COLOR, AchievementResult } from '../../../lib/achievements';
import { useAuthStore } from '../../../store/authStore';
import styles from './page.module.scss';

type LucideIcon = React.ComponentType<{ size?: number; strokeWidth?: number }>;
const Icons = LucideIcons as unknown as Record<string, LucideIcon>;

const XP_PER_LEVEL = 1000;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function AchievementCard({ a }: { a: AchievementResult }) {
  const Icon = Icons[a.icon];
  const color = RANK_COLOR[a.rank];
  const isSecret = a.secret && !a.unlocked;
  const tooltipText = isSecret ? '???' : `${a.description}${a.unlocked ? ` · +${a.xp} XP` : ''}`;

  return (
    <div
      className={[styles.achCard, a.unlocked ? styles.achCardUnlocked : styles.achCardLocked].join(' ')}
      data-tooltip={tooltipText}
    >
      <div
        className={styles.achIcon}
        style={a.unlocked ? { background: color + '20', color } : undefined}
      >
        {isSecret
          ? <span className={styles.achSecretGlyph}>?</span>
          : Icon ? <Icon size={18} strokeWidth={1.75} /> : <span>🏆</span>
        }
      </div>
      <div className={styles.achBody}>
        <span className={styles.achTitle}>
          {isSecret ? '???' : a.title}
        </span>
        <span className={styles.achRank} style={a.unlocked ? { color } : undefined}>
          {RANK_LABEL[a.rank]}
        </span>
      </div>
      {a.unlocked && <div className={styles.achCheck}>✓</div>}
    </div>
  );
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

  const { data: achievements = [] } = useQuery({
    queryKey: ['achievements'],
    queryFn: achievementsApi.getAll,
    enabled: isOwn && !!me,
  });

  const initial = profile
    ? (profile.displayName ?? profile.username)[0].toUpperCase()
    : '?';

  const xp    = profile?.xp ?? 0;
  const level = profile?.level ?? 0;
  const xpInLevel = xp % XP_PER_LEVEL;
  const xpPct = (xpInLevel / XP_PER_LEVEL) * 100;

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  // Группировка по рангу для витрины
  const grouped = [4, 3, 2, 1].map(rank => ({
    rank,
    items: achievements.filter(a => a.rank === rank),
  })).filter(g => g.items.length);

  return (
    <div className={styles.root}>
      <Header />

      {isLoading && <div className={styles.state}>Загрузка...</div>}
      {isError   && <div className={styles.state}>Пользователь не найден</div>}

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
                <div className={styles.nameRow}>
                  <span className={styles.displayName}>
                    {profile.displayName ?? profile.username}
                  </span>
                  <span className={styles.levelBadge}>Ур. {level}</span>
                </div>
                <span className={styles.username}>@{profile.username}</span>
              </div>

              {/* XP bar */}
              <div className={styles.xpWrap}>
                <div className={styles.xpBar}>
                  <div className={styles.xpFill} style={{ width: `${xpPct}%` }} />
                </div>
                <span className={styles.xpLabel}>{xpInLevel} / {XP_PER_LEVEL} XP</span>
              </div>

              {profile.bio && <p className={styles.bio}>{profile.bio}</p>}

              <div className={styles.meta}>Участник с {formatDate(profile.createdAt)}</div>

              {isOwn && (
                <Link href="/settings" className={styles.editBtn}>
                  Редактировать профиль
                </Link>
              )}
            </div>

            {/* Блок достижений */}
            {isOwn && achievements.length > 0 && (
              <div className={styles.achSection}>
                <div className={styles.achHeader}>
                  <span className={styles.achTitle2}>Достижения</span>
                  <span className={styles.achCount}>{unlockedCount} / {achievements.length}</span>
                </div>

                {grouped.map(({ rank, items }) => (
                  <div key={rank} className={styles.achGroup}>
                    <span
                      className={styles.achGroupLabel}
                      style={{ color: RANK_COLOR[rank as 1|2|3|4] }}
                    >
                      {RANK_LABEL[rank as 1|2|3|4]}
                    </span>
                    <div className={styles.achGrid}>
                      {items.map(a => <AchievementCard key={a.id} a={a} />)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
