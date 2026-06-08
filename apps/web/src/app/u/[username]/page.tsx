'use client';

import { use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Calendar as CalIcon, Trophy, UserX, GitBranch } from 'lucide-react';
import { Header } from '../../../components/Header';
import { AvatarFramed } from '../../../components/AvatarFramed';
import { Button, Card, Badge, Skeleton, EmptyState, Modal } from '../../../components/ui';
import { AchievementTree } from '../../../components/achievements/AchievementTree';
import { profileApi } from '../../../lib/profile';
import { achievementsApi } from '../../../lib/achievements';
import { SOCIAL_PROVIDERS, resolveSocialHref } from '../../../lib/socials';
import { Icon } from '../../../lib/icons';
import { useAuthStore } from '../../../store/authStore';
import styles from './page.module.scss';

const XP_PER_LEVEL = 1000;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function ProfileSkeleton() {
  return (
    <div className={styles.columns}>
      <aside className={styles.sideCol}>
        <Card padding="md">
          <Skeleton text width="40%" height={20} />
          <div style={{ height: 12 }} />
          <Skeleton text width="100%" />
          <div style={{ height: 6 }} />
          <Skeleton text width="80%" />
        </Card>
        <Card padding="md">
          <Skeleton text width="40%" height={20} />
          <div style={{ height: 12 }} />
          <Skeleton width="100%" height={10} />
        </Card>
      </aside>
      <main className={styles.mainCol}>
        <Card padding="md">
          <Skeleton text width="30%" height={20} />
          <div style={{ height: 16 }} />
          <Skeleton width="100%" height={60} />
          <div style={{ height: 8 }} />
          <Skeleton width="100%" height={60} />
        </Card>
      </main>
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
  const [treeOpen, setTreeOpen] = useState(false);

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

  const socialEntries = profile?.socialLinks
    ? SOCIAL_PROVIDERS
        .map(p => ({ provider: p, value: profile.socialLinks?.[p.id] }))
        .filter((e): e is { provider: typeof e.provider; value: string } => !!e.value)
    : [];

  return (
    <div className={styles.root}>
      <Header />

      {isLoading && <ProfileSkeleton />}

      {isError && (
        <EmptyState
          size="lg"
          icon={<UserX size={48} strokeWidth={1.25} />}
          title="Пользователь не найден"
          description="Возможно, ссылка устарела или пользователь удалил аккаунт."
        />
      )}

      {profile && (
        <div className={styles.body}>
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
                  <Badge variant="brand" shape="pill">Ур. {level}</Badge>
                  {isOwn && me && (
                    <Badge variant="accent" shape="pill" title="Ваши монеты">
                      <span className={styles.coinDot} aria-hidden="true" /> {me.coins ?? 0}
                    </Badge>
                  )}
                </div>
                <span className={styles.username}>@{profile.username}</span>

                {socialEntries.length > 0 && (
                  <div className={styles.socials}>
                    {socialEntries.map(({ provider, value }) => (
                      <a
                        key={provider.id}
                        href={resolveSocialHref(provider.id, value)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.socialChip}
                        style={{ '--social-color': provider.color } as React.CSSProperties}
                        title={`${provider.label}: ${value}`}
                      >
                        <Icon name={provider.icon} size={14} strokeWidth={2} />
                        <span className={styles.socialLabel}>{provider.label}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.heroActions}>
                {isOwn && (
                  <Button href="/settings" variant="secondary">
                    Редактировать профиль
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className={styles.columns}>
            <aside className={styles.sideCol}>
              <Card padding="md">
                <h2 className={styles.cardTitle}>О себе</h2>
                {profile.bio
                  ? <p className={styles.bio}>{profile.bio}</p>
                  : <p className={styles.muted}>Пользователь пока ничего не рассказал.</p>}

                <ul className={styles.metaList}>
                  {profile.location && (
                    <li>
                      <MapPin size={16} strokeWidth={1.75} />
                      <span>{profile.location}</span>
                    </li>
                  )}
                  <li>
                    <CalIcon size={16} strokeWidth={1.75} />
                    <span>На сайте с {formatDate(profile.createdAt)}</span>
                  </li>
                </ul>
              </Card>

              <Card padding="md">
                <h2 className={styles.cardTitle}>Опыт</h2>
                <div className={styles.xpRow}>
                  <span className={styles.xpLevel}>Ур. {level}</span>
                  <span className={styles.xpLabel}>{xpInLevel} / {XP_PER_LEVEL} XP</span>
                </div>
                <div
                  className={styles.xpBar}
                  role="progressbar"
                  aria-valuenow={xpInLevel}
                  aria-valuemin={0}
                  aria-valuemax={XP_PER_LEVEL}
                  aria-label={`Прогресс XP: ${xpInLevel} из ${XP_PER_LEVEL}`}
                >
                  <div className={styles.xpFill} style={{ width: `${xpPct}%` }} />
                </div>
              </Card>
            </aside>

            <main className={styles.mainCol}>
              {isOwn && achievements.length > 0 ? (
                <Card padding="md">
                  <div className={styles.achHead}>
                    <h2 className={styles.cardTitle}>Достижения</h2>
                    <span className={styles.achCount}>{unlockedCount} / {achievements.length}</span>
                  </div>
                  <p className={styles.muted}>
                    Открывайте достижения шаг за шагом — каждое ведёт к следующему.
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => setTreeOpen(true)}
                    leftIcon={<GitBranch size={18} strokeWidth={1.75} />}
                  >
                    Дерево достижений
                  </Button>
                </Card>
              ) : isOwn && achievements.length === 0 ? (
                <Card padding="md">
                  <EmptyState
                    icon={<Trophy size={48} strokeWidth={1.25} />}
                    title="Достижения скоро появятся"
                    description="Выполните первую задачу — и откроется ваше первое достижение."
                  />
                </Card>
              ) : (
                <Card padding="md">
                  <h2 className={styles.cardTitle}>Профиль</h2>
                  <p className={styles.muted}>Достижения видны только владельцу профиля.</p>
                </Card>
              )}
            </main>
          </div>
        </div>
      )}

      {isOwn && (
        <Modal
          open={treeOpen}
          onClose={() => setTreeOpen(false)}
          title="Дерево достижений"
          size="xl"
          noPadding
          ariaLabel="Дерево достижений"
          className={styles.treeModal}
        >
          <AchievementTree achievements={achievements} />
        </Modal>
      )}
    </div>
  );
}
