'use client';

import { useState } from 'react';
import {
  Plus, CheckCircle2, RotateCcw, Pencil, ArrowRightLeft, Trash2, FolderPlus,
  ChevronDown, type LucideIcon,
} from 'lucide-react';
import { ActivityEvent, ActivityType } from '../../../lib/activity';
import styles from './ActivityFeed.module.scss';

interface Props {
  events: ActivityEvent[];
  /** Сколько событий показывать в свёрнутом виде. */
  collapsedCount?: number;
}

const ICONS: Record<ActivityType, { icon: LucideIcon; color: string }> = {
  task_created: { icon: Plus, color: '#3b82f6' },
  task_completed: { icon: CheckCircle2, color: '#22c55e' },
  task_reopened: { icon: RotateCcw, color: '#eab308' },
  task_updated: { icon: Pencil, color: 'var(--text-muted)' },
  task_moved: { icon: ArrowRightLeft, color: '#3b82f6' },
  task_deleted: { icon: Trash2, color: '#ef4444' },
  project_created: { icon: FolderPlus, color: 'var(--brand)' },
};

/** Лента изменений под heatmap: свёрнута до N строк, разворачивается в скролл. */
export function ActivityFeed({ events, collapsedCount = 5 }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!events.length) {
    return <div className={styles.empty}>Пока нет изменений</div>;
  }

  const shown = expanded ? events : events.slice(0, collapsedCount);
  const hasMore = events.length > collapsedCount;

  return (
    <div className={styles.root}>
      <ul className={`${styles.list} ${expanded ? styles.scroll : ''}`}>
        {shown.map((e) => {
          const { icon: Icon, color } = ICONS[e.type] ?? ICONS.task_updated;
          return (
            <li key={e.id} className={styles.item}>
              <span className={styles.icon} style={{ color }}>
                <Icon size={14} />
              </span>
              <span className={styles.summary}>{e.summary}</span>
              <time className={styles.time} dateTime={e.createdAt}>
                {relativeTime(e.createdAt)}
              </time>
            </li>
          );
        })}
      </ul>

      {hasMore && (
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setExpanded((v) => !v)}
        >
          <ChevronDown
            size={14}
            className={expanded ? styles.chevronUp : undefined}
          />
          {expanded ? 'Свернуть' : `Показать все (${events.length})`}
        </button>
      )}
    </div>
  );
}

/** Относительное время: «только что», «5 мин назад», «вчера», «3 дн назад». */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'вчера';
  if (days < 30) return `${days} дн назад`;
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}
