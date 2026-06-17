'use client';

import { useMemo } from 'react';
import { Smile, Meh, Frown } from 'lucide-react';
import { Task } from '../../../lib/tasks';
import { Project } from '../../../lib/projects';
import { computeProjectMood, MoodLevel } from '../../../lib/projectMood';
import styles from './ProjectMood.module.scss';

interface Props {
  project: Project;
  tasks: Task[];
}

/** Иконка + класс-акцент по уровню настроения. */
const MOOD_VISUAL: Record<MoodLevel, { icon: typeof Smile; cls: string }> = {
  good: { icon: Smile, cls: styles.good },
  warn: { icon: Meh, cls: styles.warn },
  bad: { icon: Frown, cls: styles.bad },
};

/**
 * Карточка «Настроение проекта»: лаконичный виджет-индикатор состояния задач
 * (значок-лицо + подпись + причина + чипы сигналов). Цвет акцента — семантический
 * (success/warning/error), адаптируется под тему.
 */
export function ProjectMood({ project, tasks }: Props) {
  const mood = useMemo(
    () => computeProjectMood(tasks, project),
    [tasks, project],
  );
  const visual = MOOD_VISUAL[mood.level];
  const Icon = visual.icon;
  const s = mood.signals;

  return (
    <section className={[styles.card, visual.cls].join(' ')}>
      <h3 className={styles.title}>Настроение проекта</h3>

      <div className={styles.body}>
        <span className={styles.badge}>
          <Icon size={30} strokeWidth={2} />
        </span>

        <div className={styles.text}>
          <span className={styles.label}>{mood.label}</span>
          <span className={styles.reason}>{mood.reason}</span>
        </div>

        <div className={styles.signals}>
          <div className={styles.chip}>
            <span className={styles.chipValue}>{s.open}</span>
            <span className={styles.chipLabel}>в работе</span>
          </div>
          <div
            className={[styles.chip, s.overdue > 0 ? styles.chipBad : ''].join(' ')}
          >
            <span className={styles.chipValue}>{s.overdue}</span>
            <span className={styles.chipLabel}>просрочено</span>
          </div>
          <div
            className={[styles.chip, s.stuck > 0 ? styles.chipWarn : ''].join(' ')}
          >
            <span className={styles.chipValue}>{s.stuck}</span>
            <span className={styles.chipLabel}>застряли</span>
          </div>
        </div>
      </div>
    </section>
  );
}
