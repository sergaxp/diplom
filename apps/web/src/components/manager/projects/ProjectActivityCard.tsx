'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity } from 'lucide-react';
import { activityApi } from '../../../lib/activity';
import { HeatmapGrid } from '../heatmap/HeatmapGrid';
import { ActivityFeed } from '../heatmap/ActivityFeed';
import styles from './ProjectActivityCard.module.scss';

interface Props {
  projectId: string;
}

/** Карточка активности проекта: heatmap (как у GitHub) + сворачиваемая лента. */
export function ProjectActivityCard({ projectId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['project-activity', projectId],
    queryFn: () => activityApi.getProjectActivity(projectId),
    enabled: !!projectId,
  });

  return (
    <section className={styles.card}>
      <header className={styles.header}>
        <Activity size={16} />
        <h3 className={styles.title}>Активность</h3>
      </header>

      {isLoading ? (
        <div className={styles.placeholder}>Загрузка…</div>
      ) : (
        <>
          <HeatmapGrid days={data?.days ?? []} caption="" />
          <div className={styles.feedWrap}>
            <ActivityFeed events={data?.events ?? []} />
          </div>
        </>
      )}
    </section>
  );
}
