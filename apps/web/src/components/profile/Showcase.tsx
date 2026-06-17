'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Trophy, Coins, Zap, FileText, Frame as FrameIcon } from 'lucide-react';
import { Card } from '../ui';
import { showcaseApi, ShowcaseBlock, SHOWCASE_LABELS } from '../../lib/showcases';
import { postsApi } from '../../lib/posts';
import { FRAME_DECOS } from '../../lib/shop';
import { PublicProfile } from '../../lib/profile';
import { activityApi } from '../../lib/activity';
import { HeatmapGrid } from '../manager/heatmap/HeatmapGrid';
import styles from './profile.module.scss';

export function Showcase({
  block,
  profile,
}: {
  block: ShowcaseBlock;
  profile: PublicProfile;
}) {
  return (
    <Card padding="md">
      <h2 className={styles.cardTitle}>{SHOWCASE_LABELS[block.type]}</h2>
      {block.type === 'stats' && <ShowcaseStats username={profile.username} />}
      {block.type === 'favorites' && <ShowcaseFavorites username={profile.username} />}
      {block.type === 'featuredPosts' && <ShowcaseFeaturedPosts profile={profile} />}
      {block.type === 'heatmap' && <ShowcaseHeatmap username={profile.username} />}
    </Card>
  );
}

/** Профильный heatmap показываем за последние ~4 месяца (≈18 недель). */
const PROFILE_HEATMAP_WEEKS = 18;

function ShowcaseHeatmap({ username }: { username: string }) {
  const { data } = useQuery({
    queryKey: ['profileActivity', username],
    queryFn: () => activityApi.getUserActivity(username),
  });
  return (
    <HeatmapGrid
      days={data?.days ?? []}
      weeks={PROFILE_HEATMAP_WEEKS}
      caption="Активность за 4 месяца"
    />
  );
}

function ShowcaseStats({ username }: { username: string }) {
  const { data } = useQuery({
    queryKey: ['profileStats', username],
    queryFn: () => showcaseApi.getStats(username),
  });
  if (!data) return null;

  const items = [
    { icon: <Zap size={18} strokeWidth={1.75} />, label: 'Уровень', value: data.level },
    { icon: <FileText size={18} strokeWidth={1.75} />, label: 'Постов', value: data.postCount },
    { icon: <Trophy size={18} strokeWidth={1.75} />, label: 'Достижений', value: `${data.achievementCount}/${data.achievementTotal}` },
    { icon: <Coins size={18} strokeWidth={1.75} />, label: 'Монет', value: data.coins },
  ];

  return (
    <div className={styles.statsGrid}>
      {items.map((it) => (
        <div key={it.label} className={styles.statCell}>
          <span className={styles.statIcon}>{it.icon}</span>
          <span className={styles.statValue}>{it.value}</span>
          <span className={styles.statLabel}>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

function ShowcaseFavorites({ username }: { username: string }) {
  const { data: itemIds = [] } = useQuery({
    queryKey: ['profileInventory', username],
    queryFn: () => showcaseApi.getInventory(username),
  });

  const frames = itemIds.filter((id) => id in FRAME_DECOS);
  if (frames.length === 0) {
    return <p className={styles.mutedSmall}>Нет купленных предметов.</p>;
  }

  return (
    <div className={styles.favGrid}>
      {frames.map((id) => {
        const deco = FRAME_DECOS[id];
        return (
          <div key={id} className={styles.favItem} title={deco.label}>
            {deco.image ? (
              <span className={styles.favSwatch}>
                {/* eslint-disable-next-line @next/next/no-img-element -- декоративный PNG из public/ */}
                <img src={deco.image} alt="" className={styles.favSwatchImg} />
              </span>
            ) : (
              <span
                className={styles.favSwatch}
                style={{ background: `linear-gradient(135deg, ${deco.color}, ${deco.color}66)` }}
              >
                <FrameIcon size={20} strokeWidth={1.75} />
              </span>
            )}
            <span className={styles.favLabel}>{deco.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function ShowcaseFeaturedPosts({ profile }: { profile: PublicProfile }) {
  const { data: posts = [] } = useQuery({
    queryKey: ['posts', profile.username],
    queryFn: () => postsApi.list(profile.username),
  });

  const pinned = posts.filter((p) => p.pinned).slice(0, 4);
  if (pinned.length === 0) {
    return <p className={styles.mutedSmall}>Нет закреплённых постов.</p>;
  }

  return (
    <ul className={styles.featuredList}>
      {pinned.map((p) => (
        <li key={p.id} className={styles.featuredItem}>
          {p.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imageUrl} alt="" className={styles.featuredThumb} />
          )}
          <p className={styles.featuredText}>{p.text}</p>
        </li>
      ))}
      <li>
        <Link href={`/u/${profile.username}`} className={styles.inlineLink}>
          Все посты
        </Link>
      </li>
    </ul>
  );
}
