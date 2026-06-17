'use client';

import { useMemo } from 'react';
import { Task, toDateStr } from '../../../lib/tasks';
import { Project, projectProgress } from '../../../lib/projects';
import { EmptyState } from '../../ui';
import { BarChart3 } from 'lucide-react';
import { ProjectMood } from './ProjectMood';
import { ProjectActivityCard } from './ProjectActivityCard';
import styles from './ProjectStats.module.scss';

interface Props { project: Project; tasks: Task[] }

/** Нижняя строка: настроение (слева) + heatmap активности с лентой (справа). */
function MoodActivityRow({ project, tasks }: Props) {
  return (
    <div className={styles.bottomRow}>
      <ProjectMood project={project} tasks={tasks} />
      <ProjectActivityCard projectId={project.id} />
    </div>
  );
}

const DAYS = 14;

export function ProjectStats({ project, tasks }: Props) {
  const stats = useMemo(() => {
    const list = tasks.filter(t => t.projectId === project.id);
    const todayStr = toDateStr(new Date());
    const prog = projectProgress(tasks, project.id);
    let backlog = 0, scheduled = 0, overdue = 0;
    for (const t of list) {
      if (t.completedAt) continue;
      if (!t.date) backlog++;
      else { scheduled++; if (t.date < todayStr) overdue++; }
    }

    // Выполнено по дням (последние DAYS дней).
    const byDay = new Map<string, number>();
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      byDay.set(toDateStr(d), 0);
    }
    for (const t of list) {
      if (!t.completedAt) continue;
      const ds = toDateStr(new Date(t.completedAt));
      if (byDay.has(ds)) byDay.set(ds, (byDay.get(ds) ?? 0) + 1);
    }
    const series = [...byDay.entries()].map(([date, n]) => ({ date, n }));
    const peak = Math.max(1, ...series.map(s => s.n));

    return { total: prog.total, done: prog.done, pct: prog.pct, backlog, scheduled, overdue, series, peak };
  }, [tasks, project.id]);

  if (stats.total === 0) {
    return (
      <div className={styles.root}>
        <EmptyState size="md" icon={<BarChart3 size={44} strokeWidth={1.25} />}
          title="Пока нет данных" description="Добавьте задачи в проект, чтобы увидеть статистику." />
        <MoodActivityRow project={project} tasks={tasks} />
      </div>
    );
  }

  const cards = [
    { label: 'Всего задач', value: stats.total },
    { label: 'Выполнено', value: stats.done, accent: 'var(--brand)' },
    { label: 'В работе', value: stats.scheduled },
    { label: 'Бэклог', value: stats.backlog },
    { label: 'Просрочено', value: stats.overdue, accent: stats.overdue > 0 ? 'var(--error)' : undefined },
  ];

  return (
    <div className={styles.root}>
      <div className={styles.cards}>
        {cards.map(c => (
          <div key={c.label} className={styles.card}>
            <span className={styles.cardValue} style={c.accent ? { color: c.accent } : undefined}>{c.value}</span>
            <span className={styles.cardLabel}>{c.label}</span>
          </div>
        ))}
        <ProjectMood project={project} tasks={tasks} />
      </div>

      <div className={styles.chartBox}>
        <span className={styles.chartTitle}>Выполнено за последние {DAYS} дней</span>
        {stats.series.some(s => s.n > 0) ? (
          <div className={styles.chart}>
            {stats.series.map(s => {
              const d = new Date(s.date + 'T00:00:00');
              return (
                <div key={s.date} className={styles.barCol} title={`${s.date}: ${s.n}`}>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{ height: `${(s.n / stats.peak) * 100}%`, background: project.color ?? 'var(--brand)' }}
                    />
                  </div>
                  <span className={styles.barDay}>{d.getDate()}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.chartEmpty}>За этот период выполненных задач не было.</div>
        )}
      </div>

      <div className={styles.bottomRow}>
        <ProjectActivityCard projectId={project.id} />
      </div>
    </div>
  );
}
