'use client';

import { useEffect } from 'react';
import { useAchievementStore } from '../store/achievementStore';
import { RANK_LABEL, RANK_COLOR } from '../lib/achievements';
import { Icon, hasIcon } from '../lib/icons';
import styles from './AchievementToast.module.scss';

const DISPLAY_MS = 4000;

export function AchievementToast() {
  const { queue, pop } = useAchievementStore();
  const current = queue[0];
  const currentId = current?.id;

  useEffect(() => {
    if (!currentId) return;
    const t = setTimeout(pop, DISPLAY_MS);
    return () => clearTimeout(t);
  }, [currentId, pop]);

  if (!current) return null;

  const rankColor = RANK_COLOR[current.rank];

  return (
    <div className={styles.toast} style={{ '--rank-color': rankColor } as React.CSSProperties}>
      <div className={styles.iconWrap} style={{ background: rankColor + '22', color: rankColor }}>
        {hasIcon(current.icon) ? <Icon name={current.icon} size={20} strokeWidth={1.75} /> : '🏆'}
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
