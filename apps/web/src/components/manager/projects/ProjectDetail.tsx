'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, Pencil, Trash2, Plus, LayoutGrid, BarChart3, Flag, X, Archive } from 'lucide-react';
import { Task, SubtaskItem } from '../../../lib/tasks';
import type { Tag } from '../../../lib/tags';
import {
  Project, ProjectMilestone, UpdateProjectInput, DeleteProjectMode,
  projectProgress, isAutoArchived,
} from '../../../lib/projects';
import { Icon, hasIcon } from '../../../lib/icons';
import { Button } from '../../ui';
import { ProjectBoardView } from './ProjectBoardView';
import { ProjectStats } from './ProjectStats';
import { ProjectDeleteModal } from './ProjectDeleteModal';
import styles from './ProjectDetail.module.scss';

const uid = () => Math.random().toString(36).slice(2, 9);

function deadlineInfo(deadline: string | null | undefined, pct: number) {
  if (!deadline) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dl = new Date(deadline + 'T00:00:00');
  const days = Math.round((dl.getTime() - today.getTime()) / 86_400_000);
  const overdue = days < 0 && pct < 100;
  const label = days === 0 ? 'сегодня' : days > 0 ? `через ${days} дн.` : `просрочен на ${-days} дн.`;
  return { label, overdue, done: pct >= 100 };
}

interface Props {
  project: Project;
  tasks: Task[];
  userTags: Tag[];
  isAdmin: boolean;
  onBack: () => void;
  onEdit: () => void;
  onUpdateProject: (data: UpdateProjectInput) => void;
  onDeleteProject: (mode: DeleteProjectMode) => void;
  onCreateTask: (data: Omit<Task, 'id' | 'status'>) => Promise<Task>;
  onUpdateTask: (id: string, data: Omit<Task, 'id' | 'status'>, occDate?: string) => void;
  onDeleteTask: (id: string) => void;
  onSetTaskDone: (taskId: string, done: boolean) => void;
  onSetSubtaskDone: (taskId: string, itemId: string, done: boolean) => void;
  onSetAllSubtasksDone: (taskId: string, done: boolean) => void;
  onUpdateSubtask: (taskId: string, item: SubtaskItem) => void;
  onDeleteSubtask: (taskId: string, itemId: string) => void;
  onCreateTag?: (name: string, color: string, icon?: string | null) => Promise<Tag>;
}

export function ProjectDetail(props: Props) {
  const { project, tasks, userTags, isAdmin, onBack, onEdit, onUpdateProject, onDeleteProject } = props;
  const [tab, setTab] = useState<'board' | 'stats'>('board');
  const [activeMilestone, setActiveMilestone] = useState<string | 'all' | 'none'>('all');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const archivedCount = useMemo(
    () => tasks.filter(t => t.projectId === project.id && isAutoArchived(t.completedAt)).length,
    [tasks, project.id],
  );

  const tag = userTags.find(t => t.id === project.tagId) ?? null;
  const progress = useMemo(() => projectProgress(tasks, project.id), [tasks, project.id]);
  const dl = deadlineInfo(project.deadline, progress.pct);
  const milestones = useMemo(
    () => [...(project.milestones ?? [])].sort((a, b) => a.position - b.position),
    [project.milestones],
  );
  const accent = project.color ?? 'var(--brand)';

  const addMilestone = (name: string) => {
    const next: ProjectMilestone = { id: uid(), name: name.trim(), position: milestones.length };
    onUpdateProject({ milestones: [...milestones, next] });
  };
  const removeMilestone = (id: string) => {
    onUpdateProject({ milestones: milestones.filter(m => m.id !== id) });
    if (activeMilestone === id) setActiveMilestone('all');
  };

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headTop}>
          <button type="button" className={styles.back} onClick={onBack} aria-label="К списку проектов">
            <ArrowLeft size={18} />
          </button>
          <span className={styles.icon} style={{ background: `${accent}22`, color: accent }}>
            {hasIcon(project.icon) ? <Icon name={project.icon!} size={20} strokeWidth={1.75} /> : <LayoutGrid size={20} />}
          </span>
          <div className={styles.titleWrap}>
            <h2 className={styles.name}>{project.name}</h2>
            {project.description && <p className={styles.desc}>{project.description}</p>}
          </div>
          <div className={styles.headActions}>
            <Button variant="secondary" size="sm" leftIcon={<Pencil size={14} />} onClick={onEdit}>Изменить</Button>
            <Button variant="ghost" size="sm" leftIcon={<Trash2 size={14} />} onClick={() => setDeleteOpen(true)}>Удалить</Button>
          </div>
        </div>

        {(tag || dl) && (
          <div className={styles.metaRow}>
            {tag && (
              <span className={styles.tag} style={{ borderColor: tag.color }}>
                {hasIcon(tag.icon) ? <Icon name={tag.icon} size={11} strokeWidth={2.5} /> : <span className={styles.tagDot} style={{ background: tag.color }} />}
                {tag.name}
              </span>
            )}
            {dl && (
              <span className={[styles.deadline, dl.overdue ? styles.deadlineOverdue : '', dl.done ? styles.deadlineDone : ''].join(' ')}>
                <Flag size={12} /> {project.deadline} · {dl.done ? 'выполнен' : dl.label}
              </span>
            )}
          </div>
        )}

        <div className={styles.progress}>
          <span className={styles.progressLabel}>Прогресс</span>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progress.pct}%`, background: accent }} />
          </div>
          <span className={styles.progressText}>{progress.done}/{progress.total} · {progress.pct}%</span>
        </div>

        {/* Tabs + milestones */}
        <div className={styles.toolbar}>
          <div className={styles.tabs}>
            <button type="button" className={[styles.tabBtn, tab === 'board' ? styles.tabActive : ''].join(' ')} onClick={() => setTab('board')}>
              <LayoutGrid size={14} /> Доска
            </button>
            <button type="button" className={[styles.tabBtn, tab === 'stats' ? styles.tabActive : ''].join(' ')} onClick={() => setTab('stats')}>
              <BarChart3 size={14} /> Статистика
            </button>
          </div>

          {tab === 'board' && (
            <div className={styles.milestones}>
              <button type="button" className={[styles.ms, activeMilestone === 'all' ? styles.msActive : ''].join(' ')} onClick={() => setActiveMilestone('all')}>Все</button>
              {milestones.map(m => (
                <span key={m.id} className={[styles.ms, activeMilestone === m.id ? styles.msActive : ''].join(' ')}>
                  <button type="button" className={styles.msLabel} onClick={() => setActiveMilestone(m.id)}>{m.name}</button>
                  <button type="button" className={styles.msDel} onClick={() => removeMilestone(m.id)} aria-label="Удалить этап"><X size={11} /></button>
                </span>
              ))}
              {milestones.length > 0 && (
                <button type="button" className={[styles.ms, activeMilestone === 'none' ? styles.msActive : ''].join(' ')} onClick={() => setActiveMilestone('none')}>Без этапа</button>
              )}
              {addingMilestone ? (
                <input
                  className={styles.msInput}
                  autoFocus
                  placeholder="Название этапа"
                  onBlur={(e) => { if (e.target.value.trim()) addMilestone(e.target.value); setAddingMilestone(false); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setAddingMilestone(false); }}
                />
              ) : (
                <button type="button" className={styles.msAdd} onClick={() => setAddingMilestone(true)}><Plus size={12} /> Этап</button>
              )}
            </div>
          )}

          {tab === 'board' && archivedCount > 0 && (
            <button
              type="button"
              className={[styles.archiveBtn, showArchive ? styles.archiveBtnActive : ''].join(' ')}
              onClick={() => setShowArchive(v => !v)}
            >
              <Archive size={13} /> {showArchive ? 'Скрыть архив' : `Архив (${archivedCount})`}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {tab === 'board' ? (
        <ProjectBoardView
          project={project}
          tasks={tasks}
          userTags={userTags}
          isAdmin={isAdmin}
          activeMilestone={activeMilestone}
          showArchive={showArchive}
          onCreateTask={props.onCreateTask}
          onUpdateTask={props.onUpdateTask}
          onDeleteTask={props.onDeleteTask}
          onSetTaskDone={props.onSetTaskDone}
          onSetSubtaskDone={props.onSetSubtaskDone}
          onSetAllSubtasksDone={props.onSetAllSubtasksDone}
          onUpdateSubtask={props.onUpdateSubtask}
          onDeleteSubtask={props.onDeleteSubtask}
          onCreateTag={props.onCreateTag}
        />
      ) : (
        <ProjectStats project={project} tasks={tasks} />
      )}

      <ProjectDeleteModal
        open={deleteOpen}
        projectName={project.name}
        onClose={() => setDeleteOpen(false)}
        onConfirm={(mode) => { setDeleteOpen(false); onDeleteProject(mode); }}
      />
    </div>
  );
}
