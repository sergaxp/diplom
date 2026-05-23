'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import * as LucideIcons from 'lucide-react';
import { MapPin, Calendar as CalIcon } from 'lucide-react';
import { Header } from '../../../components/Header';
import { AvatarFramed } from '../../../components/AvatarFramed';
import { profileApi } from '../../../lib/profile';
import { achievementsApi, RANK_LABEL, RANK_COLOR, AchievementResult } from '../../../lib/achievements';
import { SOCIAL_PROVIDERS, getSocialIcon, resolveSocialHref } from '../../../lib/socials';
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
          : Icon ? <Icon size={18} strokeWidth={1.75} /> : <span>🏆</span>}
      </div>
      <div className={styles.achBody}>
        <span className={styles.achTitle}>{isSecret ? '???' : a.title}</span>
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

  const xp        = profile?.xp ?? 0;
  const level     = profile?.level ?? 0;
  const xpInLevel = xp % XP_PER_LEVEL;
  const xpPct     = (xpInLevel / XP_PER_LEVEL) * 100;

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  const grouped = [4, 3, 2, 1].map(rank => ({
    rank,
    items: achievements.filter(a => a.rank === rank),
  })).filter(g => g.items.length);

  // socialLinks как массив, сохраняя порядок SOCIAL_PROVIDERS
  const socialEntries = profile?.socialLinks
    ? SOCIAL_PROVIDERS
        .map(p => ({ provider: p, value: profile.socialLinks?.[p.id] }))
        .filter((e): e is { provider: typeof e.provider; value: string } => !!e.value)
    : [];

  return (
    <div className={styles.root}>
      <Header />

      {isLoading && <div className={styles.state}>Загрузка...</div>}
      {isError   && <div className={styles.state}>Пользователь не найден</div>}

      {profile && (
        <div className={styles.body}>
          {/* ── Hero (banner + avatar + actions) ────────────────── */}
          <div
            className={[styles.banner, profile.coverUrl ? styles.bannerHasImage : ''].join(' ')}
            style={profile.coverUrl ? { backgroundImage: `url(${profile.coverUrl})` } : undefined}
          />

          <div className={styles.hero}>
            <div className={styles.heroInner}>
              <div className={styles.avatarWrap}>
                <AvatarFramed
                  avatarUrl={profile.avatarUrl}
                  displayName={profile.displayName}
                  username={profile.username}
                  frameId={profile.selectedFrame}
                  size={120}
                />
              </div>

              <div className={styles.heroMain}>
                <div className={styles.nameRow}>
                  <h1 className={styles.displayName}>
                    {profile.displayName ?? profile.username}
                  </h1>
                  <span className={styles.levelBadge}>Ур. {level}</span>
                  {isOwn && me && (
                    <span className={styles.coinsBadge} title="Ваши монеты">
                      <span className={styles.coinDot} /> {me.coins ?? 0}
                    </span>
                  )}
                </div>
                <span className={styles.username}>@{profile.username}</span>

                {socialEntries.length > 0 && (
                  <div className={styles.socials}>
                    {socialEntries.map(({ provider, value }) => {
                      const Ic = getSocialIcon(provider.id);
                      return (
                        <a
                          key={provider.id}
                          href={resolveSocialHref(provider.id, value)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.socialChip}
                          style={{ '--social-color': provider.color } as React.CSSProperties}
                          title={`${provider.label}: ${value}`}
                        >
                          {Ic && <Ic size={14} strokeWidth={2} />}
                          <span className={styles.socialLabel}>{provider.label}</span>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className={styles.heroActions}>
                {isOwn && (
                  <Link href="/settings" className={styles.editBtn}>
                    Редактировать профиль
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* ── Two-column body ─────────────────────────────────── */}
          <div className={styles.columns}>
            {/* Left –  about */}
            <aside className={styles.sideCol}>
              <div className={styles.card}>
                <h2 className={styles.cardTitle}>О себе</h2>
                {profile.bio
                  ? <p className={styles.bio}>{profile.bio}</p>
                  : <p className={styles.muted}>Пользователь пока ничего не рассказал.</p>}

                <ul className={styles.metaList}>
                  {profile.location && (
                    <li>
                      <MapPin size={14} strokeWidth={1.75} />
                      <span>{profile.location}</span>
                    </li>
                  )}
                  <li>
                    <CalIcon size={14} strokeWidth={1.75} />
                    <span>На сайте с {formatDate(profile.createdAt)}</span>
                  </li>
                </ul>
              </div>

              <div className={styles.card}>
                <h2 className={styles.cardTitle}>Опыт</h2>
                <div className={styles.xpRow}>
                  <span className={styles.xpLevel}>Ур. {level}</span>
                  <span className={styles.xpLabel}>{xpInLevel} / {XP_PER_LEVEL} XP</span>
                </div>
                <div className={styles.xpBar}>
                  <div className={styles.xpFill} style={{ width: `${xpPct}%` }} />
                </div>
              </div>
            </aside>

            {/* Right –  achievements */}
            <main className={styles.mainCol}>
              {isOwn && achievements.length > 0 ? (
                <div className={styles.card}>
                  <div className={styles.achHead}>
                    <h2 className={styles.cardTitle}>Достижения</h2>
                    <span className={styles.achCount}>{unlockedCount} / {achievements.length}</span>
                  </div>

                  {grouped.map(({ rank, items }) => (
                    <div key={rank} className={styles.achGroup}>
                      <span className={styles.achGroupLabel} style={{ color: RANK_COLOR[rank as 1|2|3|4] }}>
                        {RANK_LABEL[rank as 1|2|3|4]}
                      </span>
                      <div className={styles.achGrid}>
                        {items.map(a => <AchievementCard key={a.id} a={a} />)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : !isOwn ? (
                <div className={styles.card}>
                  <h2 className={styles.cardTitle}>Профиль</h2>
                  <p className={styles.muted}>Достижения видны только владельцу профиля.</p>
                </div>
              ) : null}
            </main>
          </div>
        </div>
      )}
    </div>
  );
}
