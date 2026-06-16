'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, MoreHorizontal, Repeat, CalendarRange } from 'lucide-react';
import { popLayer } from '../../../lib/motion';
import { Task } from '../../../lib/tasks';
import { Icon, hasIcon } from '../../../lib/icons';
import { BoxStatus } from './boxLogic';
import styles from './BoxView.module.scss';

const TYPE_LABEL: Partial<Record<Task['type'], string>> = {
  mandatory: 'Обязательная',
  event: 'Событие',
};

const PRIORITY_LABEL: Record<string, string> = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };

interface Props {
  task: Task;
  repDate: string;
  dateLabel: string;
  isDone: boolean;
  status: BoxStatus;
  selected: boolean;
  onSelectToggle: () => void;
  onComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function BoxRow({
  task, dateLabel, isDone, status, selected,
  onSelectToggle, onComplete, onEdit, onDelete,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuOpen]);

  const isMultiDay = !!task.endDate;
  const isRepeat = task.repeat && task.repeat !== 'none';

  return (
    <motion.li
      layout
      className={[styles.row, selected ? styles.rowSelected : ''].join(' ')}
    >
      {/* Selection checkbox */}
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label={selected ? 'Снять выбор' : 'Выбрать задачу'}
        className={[styles.selectBox, selected ? styles.selectBoxOn : ''].join(' ')}
        onClick={onSelectToggle}
      >
        {selected && <Check size={12} strokeWidth={3} />}
      </button>

      {/* Completion */}
      <button
        type="button"
        role="checkbox"
        aria-checked={isDone}
        aria-label={isDone ? 'Снять отметку' : 'Отметить выполненным'}
        className={[styles.complete, isDone ? styles.completeDone : ''].join(' ')}
        onClick={onComplete}
      >
        {isDone && '✓'}
      </button>

      {/* Body */}
      <button type="button" className={styles.rowBody} onClick={onEdit}>
        {hasIcon(task.icon) && (
          <span className={styles.rowIcon}><Icon name={task.icon!} size={15} strokeWidth={1.75} /></span>
        )}
        <span className={styles.rowTitle}>{task.title}</span>

        <span className={styles.rowBadges}>
          {status === 'overdue' && <span className={[styles.badge, styles.badgeOverdue].join(' ')}>просрочено</span>}
          {TYPE_LABEL[task.type] && <span className={[styles.badge, styles.badgeType].join(' ')}>{TYPE_LABEL[task.type]}</span>}
          {task.priority && task.priority !== 'none' && (
            <span className={[styles.badge, styles[`prio_${task.priority}`]].join(' ')}>{PRIORITY_LABEL[task.priority]}</span>
          )}
          {isMultiDay && <span className={styles.metaIcon} title="Многодневная"><CalendarRange size={13} strokeWidth={2} /></span>}
          {isRepeat && <span className={styles.metaIcon} title="Повторяющаяся"><Repeat size={13} strokeWidth={2} /></span>}
          {task.tags?.slice(0, 3).map(tag => (
            <span key={tag.id} className={styles.tag} style={{ borderColor: tag.color }}>
              {hasIcon(tag.icon)
                ? <Icon name={tag.icon!} size={10} strokeWidth={2.5} />
                : <span className={styles.tagDot} style={{ background: tag.color }} />}
              {tag.name}
            </span>
          ))}
        </span>

        <span className={styles.rowDate}>{dateLabel}</span>
      </button>

      {/* Menu */}
      <div className={styles.menuWrap} ref={menuRef}>
        <button
          type="button"
          className={styles.menuBtn}
          onClick={() => setMenuOpen(v => !v)}
          aria-label="Меню задачи"
          aria-expanded={menuOpen}
        >
          <MoreHorizontal size={16} strokeWidth={2} />
        </button>
        <AnimatePresence>
          {menuOpen && (
            <motion.div className={styles.menu}
              variants={popLayer} initial="hidden" animate="visible" exit="exit">
              <button className={styles.menuItem} onClick={() => { onEdit(); setMenuOpen(false); }}>
                Редактировать
              </button>
              <div className={styles.menuDivider} />
              <button className={[styles.menuItem, styles.menuItemDanger].join(' ')}
                onClick={() => { onDelete(); setMenuOpen(false); }}>
                Удалить
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.li>
  );
}
