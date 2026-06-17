'use client';

import { use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { MapPin, Calendar as CalIcon, Trophy, UserX, GitBranch } from 'lucide-react';
import { fadeInUp } from '../../../lib/motion';
import { Header } from '../../../components/Header';
import { AvatarFramed } from '../../../components/AvatarFramed';
import { Button, Card, Badge, Skeleton, EmptyState, Modal } from '../../../components/ui';
import { AchievementTree } from '../../../components/achievements/AchievementTree';
import { ProfileBackground } from '../../../components/profile/ProfileBackground';
import { PostComposer } from '../../../components/profile/PostComposer';
import { PostFeed } from '../../../components/profile/PostFeed';
import { ProfileWall } from '../../../components/profile/ProfileWall';
import { Showcase } from '../../../components/profile/Showcase';
import { ShowcaseEditor } from '../../../components/profile/ShowcaseEditor';
import { profileApi } from '../../../lib/profile';
import { achievementsApi } from '../../../lib/achievements';
import { SOCIAL_PROVIDERS, resolveSocialHref } from '../../../lib/socials';
import { Icon } from '../../../lib/icons';
import { useAuthStore } from '../../../store/authStore';
import { usePageTitle } from '../../../hooks/useTabTitle';
import styles from './page.module.scss';

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
      </aside>
      <main className={styles.mainCol}>
        <Card padding="md">
          <Skeleton text width="30%" height={20} />
          <div style={{ height: 16 }} />
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
  usePageTitle(`Профиль @${username}`);

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['profile', username],
    queryFn: () => profileApi.getPublic(username),
  });

  const isOwn = me?.username === username;

  // Дерево достижений доступно для просмотра у любого пользователя.
  const { data: achievements = [] } = useQuery({
    queryKey: ['achievements', username],
    queryFn: () => achievementsApi.getPublic(username),
  });

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  const socialEntries = profile?.socialLinks
    ? SOCIAL_PROVIDERS
        .map(p => ({ provider: p, value: profile.socialLinks?.[p.id] }))
        .filter((e): e is { provider: typeof e.provider; value: string } => !!e.value)
    : [];

  const showcases = profile?.showcases ?? [];

  return (
    <div className={styles.root}>
      <ProfileBackground selectedBackground={profile?.selectedBackground} url={profile?.backgroundUrl} />
      <Header sticky />

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
        <motion.div className={styles.body} variants={fadeInUp} initial="hidden" animate="visible">
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
                  animate
                />
              </div>

              <div className={styles.heroMain}>
                <div className={styles.nameRow}>
                  <h1 className={styles.displayName}>
                    {profile.displayName ?? profile.username}
                  </h1>
                  <Badge variant="brand" shape="pill">Ур. {profile.level}</Badge>
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
              {/* О себе */}
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

              {/* Достижения — кнопка под «О себе» (видна на любом профиле) */}
              <Card padding="md">
                <div className={styles.achHead}>
                  <h2 className={styles.cardTitle} style={{ margin: 0 }}>Достижения</h2>
                  {achievements.length > 0 && (
                    <span className={styles.achCount}>{unlockedCount} / {achievements.length}</span>
                  )}
                </div>
                {achievements.length > 0 ? (
                  <Button
                    variant="primary"
                    onClick={() => setTreeOpen(true)}
                    leftIcon={<GitBranch size={18} strokeWidth={1.75} />}
                  >
                    Дерево достижений
                  </Button>
                ) : (
                  <EmptyState
                    icon={<Trophy size={36} strokeWidth={1.25} />}
                    title="Достижений пока нет"
                    description={isOwn
                      ? 'Выполните первую задачу — и откроется ваше первое достижение.'
                      : 'Пользователь ещё не открыл достижений.'}
                  />
                )}
              </Card>

              {/* Витрины */}
              {showcases.map((block) => (
                <Showcase key={block.id} block={block} profile={profile} />
              ))}

              {/* Редактор витрин (только владельцу) */}
              {isOwn && (
                <ShowcaseEditor username={profile.username} current={showcases} />
              )}
            </aside>

            <main className={styles.mainCol}>
              {isOwn && <PostComposer username={profile.username} />}
              <PostFeed profile={profile} isOwn={isOwn} />
              <ProfileWall username={profile.username} isOwn={isOwn} />
            </main>
          </div>
        </motion.div>
      )}

      <Modal
        open={treeOpen}
        onClose={() => setTreeOpen(false)}
        title={isOwn ? 'Дерево достижений' : `Достижения @${username}`}
        size="xl"
        noPadding
        ariaLabel="Дерево достижений"
        className={styles.treeModal}
      >
        <AchievementTree achievements={achievements} />
      </Modal>
    </div>
  );
}
