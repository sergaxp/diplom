'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, LayoutGrid, Archive, ArchiveRestore, Pencil, Flag, X, ArrowLeft } from 'lucide-react';
import { Task } from '../../../lib/tasks';
import type { Tag } from '../../../lib/tags';
import { Project, projectProgress } from '../../../lib/projects';
import { Icon, hasIcon } from '../../../lib/icons';
import { Button, EmptyState } from '../../ui';
import styles from './ProjectList.module.scss';

interface Props {
  projects: Project[];
  tasks: Task[];
  userTags: Tag[];
  onSelect: (id: string) => void;
  onCreate: () => void;
  onEdit: (project: Project) => void;
  onArchiveToggle: (project: Project) => void;
}

export function ProjectList({ projects, tasks, userTags, onSelect, onCreate, onEdit, onArchiveToggle }: Props) {
  const [showArchived, setShowArchived] = useState(false);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const visible = useMemo(
    () => projects.filter(p => !!p.archived === showArchived).sort((a, b) => a.position - b.position),
    [projects, showArchived],
  );
  const archivedCount = projects.filter(p => p.archived).length;

  // Клик вне подтверждения архивации — отмена.
  useEffect(() => {
    if (!confirmArchiveId) return;
    const h = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest(`[data-archive-confirm="${confirmArchiveId}"]`)) setConfirmArchiveId(null);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [confirmArchiveId]);

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <h2 className={styles.title}>
          <LayoutGrid size={22} strokeWidth={1.75} className={styles.titleIcon} />
          {showArchived ? 'Архив проектов' : 'Проекты'}
        </h2>
        <div className={styles.headActions}>
          {showArchived ? (
            <button type="button" className={[styles.filterBtn, styles.filterActive].join(' ')} onClick={() => setShowArchived(false)}>
              <ArrowLeft size={14} /> Активные проекты
            </button>
          ) : archivedCount > 0 ? (
            <button type="button" className={styles.filterBtn} onClick={() => setShowArchived(true)}>
              <Archive size={14} /> Архив ({archivedCount})
            </button>
          ) : null}
          {!showArchived && (
            <Button variant="accent" size="sm" leftIcon={<Plus size={16} />} onClick={onCreate}>Создать</Button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className={styles.emptyWrap}>
          <EmptyState
            size="lg"
            icon={<LayoutGrid size={48} strokeWidth={1.25} />}
            title={showArchived ? 'В архиве пусто' : 'Пока нет проектов'}
            description={showArchived ? 'Архивированные проекты появятся здесь.' : 'Создайте проект, чтобы объединить задачи, видеть прогресс и дедлайны.'}
            action={!showArchived ? <Button variant="accent" size="sm" leftIcon={<Plus size={16} />} onClick={onCreate}>Создать проект</Button> : undefined}
          />
        </div>
      ) : (
        <div className={styles.grid}>
          {visible.map(p => {
            const tag = userTags.find(t => t.id === p.tagId) ?? null;
            const prog = projectProgress(tasks, p.id);
            const accent = p.color ?? 'var(--brand)';
            const confirming = confirmArchiveId === p.id;
            return (
              <div key={p.id} className={styles.card}>
                <button type="button" className={styles.cardMain} onClick={() => onSelect(p.id)}>
                  <span className={styles.cardTop}>
                    <span className={styles.icon} style={{ background: `${accent}22`, color: accent }}>
                      {hasIcon(p.icon) ? <Icon name={p.icon!} size={22} strokeWidth={1.75} /> : <LayoutGrid size={22} />}
                    </span>
                    {tag && (
                      <span className={styles.tag} style={{ borderColor: tag.color }}>
                        {hasIcon(tag.icon) ? <Icon name={tag.icon} size={10} strokeWidth={2.5} /> : <span className={styles.tagDot} style={{ background: tag.color }} />}
                        {tag.name}
                      </span>
                    )}
                  </span>
                  <span className={styles.name}>{p.name}</span>
                  {p.description && <span className={styles.desc}>{p.description}</span>}
                  <span className={styles.progressBar}>
                    <span className={styles.progressFill} style={{ width: `${prog.pct}%`, background: accent }} />
                  </span>
                  <span className={styles.cardFoot}>
                    <span>{prog.done}/{prog.total} · {prog.pct}%</span>
                    {p.deadline && <span className={styles.deadline}><Flag size={11} /> {p.deadline}</span>}
                  </span>
                </button>
                <div
                  className={[styles.cardMenu, confirming ? styles.cardMenuVisible : ''].join(' ')}
                  data-archive-confirm={p.id}
                >
                  {confirming ? (
                    <>
                      <button type="button" className={styles.confirmBtn} onClick={() => { onArchiveToggle(p); setConfirmArchiveId(null); }}>
                        В архив
                      </button>
                      <button type="button" className={styles.menuBtn} onClick={() => setConfirmArchiveId(null)} aria-label="Отмена">
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className={styles.menuBtn} onClick={() => onEdit(p)} aria-label="Изменить проект"><Pencil size={14} /></button>
                      <button
                        type="button"
                        className={styles.menuBtn}
                        onClick={() => p.archived ? onArchiveToggle(p) : setConfirmArchiveId(p.id)}
                        aria-label={p.archived ? 'Вернуть из архива' : 'В архив'}
                      >
                        {p.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
