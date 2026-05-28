'use client';

import { useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { useAchievementStore } from '../store/achievementStore';
import { RANK_LABEL, RANK_COLOR } from '../lib/achievements';
import styles from './AchievementToast.module.scss';

type LucideIcon = React.ComponentType<{ size?: number; strokeWidth?: number }>;
const Icons = LucideIcons as unknown as Record<string, LucideIcon>;

const DISPLAY_MS = 4000;

export function AchievementToast() {
  const { queue, pop } = useAchievementStore();
  const current = queue[0];

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(pop, DISPLAY_MS);
    return () => clearTimeout(t);
  }, [current?.id, pop]);

  if (!current) return null;

  const Icon = Icons[current.icon];
  const rankColor = RANK_COLOR[current.rank];

  return (
    <div className={styles.toast} style={{ '--rank-color': rankColor } as React.CSSProperties}>
      <div className={styles.iconWrap} style={{ background: rankColor + '22', color: rankColor }}>
        {Icon ? <Icon size={20} strokeWidth={1.75} /> : '🏆'}
      </div>
      <div className={styles.body}>
        <span className={styles.header}>
          Новое достижение!
          <span className={styles.rank} style={{ color: rankColor }}>
            {RANK_LABEL[current.rank]}
          </span>
        </span>
        <span className={styles.title}>{current.title}</span>
        <span className={styles.xp}>+{current.xp} XP</span>
      </div>
      <button className={styles.close} onClick={pop} aria-label="Закрыть">✕</button>
    </div>
  );
}
