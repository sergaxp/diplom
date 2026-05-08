'use client';

import { useEffect, useRef, useState } from 'react';
import { Task, toDateStr, getTasksForDate } from '../../lib/tasks';
import { TaskFormModal } from './TaskFormModal';
import styles from './TaskList.module.scss';

const DAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTHS_GEN = ['января','февраля','марта','апреля','мая','июня',
                    'июля','августа','сентября','октября','ноября','декабря'];

function pad(n: number) { return String(n).padStart(2, '0'); }

function formatRelativeDate(dateStr: string): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d     = new Date(dateStr + 'T00:00:00');
  const diff  = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 1) return 'завтра';
  if (diff === 2) return 'послезавтра';
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}

// ── TaskItem ──────────────────────────────────────────────────
interface TaskItemProps {
  task: Task;
  dateStr: string;
  dateLabel?: string;
  onToggle: (id: string, dateStr: string) => void;
  onDelete: (id: string) => void;
  onEdit:   (task: Task) => void;
  onPostpone: (id: string, days: number) => void;
}

function TaskItem({ task, dateStr, dateLabel, onToggle, onDelete, onEdit, onPostpone }: TaskItemProps) {
  const [menuOpen,     setMenuOpen]     = useState(false);
  const [postponeOpen, setPostponeOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setPostponeOpen(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const close = () => { setMenuOpen(false); setPostponeOpen(false); };

  return (
    <li className={[styles.task, styles[`task_${task.status}`]].join(' ')}>
      {/* Checkbox */}
      <button
        className={[
          styles.checkbox,
          task.status === 'done'   ? styles.checkboxDone   : '',
          task.status === 'missed' ? styles.checkboxMissed : '',
        ].join(' ')}
        onClick={() => onToggle(task.id, dateStr)}
        aria-label={task.status === 'done' ? 'Снять отметку' : 'Отметить выполненным'}
      >
        {task.status === 'done'   && '✓'}
        {task.status === 'missed' && '✕'}
      </button>

      {/* Body */}
      <div className={styles.taskBody}>
        {task.time && <span className={styles.taskTime}>{task.time}</span>}
        <div className={styles.taskText}>
          <span className={styles.taskTitle}>{task.title}</span>
          {task.description && (
            <span className={styles.taskDesc}>{task.description}</span>
          )}
        </div>
        {task.repeat !== 'none' && (
          <span className={styles.repeatBadge} title={`Повтор: ${task.repeat}`}>
            {task.repeat === 'daily'   && '↻д'}
            {task.repeat === 'weekly'  && '↻н'}
            {task.repeat === 'monthly' && '↻м'}
            {task.repeat === 'yearly'  && '↻г'}
          </span>
        )}
        {dateLabel && (
          <span className={styles.taskDateBadge}>{dateLabel}</span>
        )}
      </div>

      {/* Menu */}
      <div className={styles.menuWrap} ref={menuRef}>
        <button className={styles.menuBtn} onClick={() => setMenuOpen(v => !v)}>···</button>

        {menuOpen && (
          <div className={styles.menu}>
            <button
              className={styles.menuItem}
              onClick={() => { onEdit(task); close(); }}
            >
              Изменить
            </button>

            {/* Перенести + submenu */}
            <div
              className={styles.postponeItem}
              onMouseEnter={() => setPostponeOpen(true)}
              onMouseLeave={() => setPostponeOpen(false)}
            >
              <button className={[styles.menuItem, styles.menuItemArrow].join(' ')}>
                Перенести <span>›</span>
              </button>

              {postponeOpen && (
                <div className={styles.submenu}>
                  {[
                    { label: 'На день',   days: 1  },
                    { label: 'На 3 дня',  days: 3  },
                    { label: 'На неделю', days: 7  },
                    { label: 'На месяц',  days: 30 },
                  ].map(({ label, days }) => (
                    <button
                      key={days}
                      className={styles.submenuItem}
                      onClick={() => { onPostpone(task.id, days); close(); }}
                    >
                      {label}
                    </button>
                  ))}
                  <div className={styles.submenuDivider} />
                  <button
                    className={styles.submenuItem}
                    onClick={() => { onEdit(task); close(); }}
                  >
                    Другое...
                  </button>
                </div>
              )}
            </div>

            <div className={styles.menuDivider} />
            <button
              className={[styles.menuItem, styles.menuItemDanger].join(' ')}
              onClick={() => { onDelete(task.id); close(); }}
            >
              Удалить
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

// ── TaskList ──────────────────────────────────────────────────
interface Props {
  selectedDate: Date;
  tasks: Task[];
  completions: Set<string>;
  isAdmin: boolean;
  onToggle:    (id: string, dateStr: string) => void;
  onDelete:    (id: string) => void;
  onAdd:       (data: Omit<Task, 'id' | 'status'>) => void;
  onUpdate:    (id: string, data: Omit<Task, 'id' | 'status'>) => void;
  onPostpone:  (id: string, days: number) => void;
  onGoToToday: () => void;
}

export function TaskList({
  selectedDate, tasks, completions, isAdmin,
  onToggle, onDelete, onAdd, onUpdate, onPostpone, onGoToToday,
}: Props) {
  const [now,         setNow]         = useState(new Date());
  const [createOpen,  setCreateOpen]  = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const selectedStr = toDateStr(selectedDate);
  const isToday     = selectedStr === toDateStr(new Date());

  const dayTasks = getTasksForDate(tasks, selectedDate, completions);

  // Future section: only mandatory tasks with a future date
  const futureTasks = tasks
    .filter(t => t.date > selectedStr && t.type === 'mandatory')
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''))
    .slice(0, 6);

  const dateLabel = isToday
    ? 'Сегодня'
    : selectedDate.toLocaleDateString('ru', { day: 'numeric', month: 'long' });

  return (
    <>
      <div className={styles.root}>
        {/* Clock — click to return to today */}
        <div className={styles.clock} onClick={onGoToToday} title="Вернуться к сегодня" role="button" tabIndex={0}>
          <span className={styles.clockTime}>{pad(now.getHours())}:{pad(now.getMinutes())}</span>
          <span className={styles.clockDay}>{DAY_SHORT[now.getDay()]}</span>
        </div>

        {/* Day tasks */}
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionLabel}>{dateLabel}</span>
            <button className={styles.addBtn} onClick={() => setCreateOpen(true)} title="Добавить задачу">+</button>
          </div>

          {dayTasks.length === 0 ? (
            <p className={styles.empty}>Нет задач на этот день</p>
          ) : (
            <ul className={styles.list}>
              {dayTasks.map(t => (
                <TaskItem
                  key={t.id}
                  task={t}
                  dateStr={selectedStr}
                  onToggle={onToggle}
                  onDelete={onDelete}
                  onEdit={setEditingTask}
                  onPostpone={onPostpone}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Future mandatory tasks */}
        {futureTasks.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionLabel}>Обязательные впереди</span>
            </div>
            <ul className={styles.list}>
              {futureTasks.map(t => (
                <TaskItem
                  key={t.id}
                  task={t}
                  dateStr={t.date}
                  dateLabel={formatRelativeDate(t.date)}
                  onToggle={onToggle}
                  onDelete={onDelete}
                  onEdit={setEditingTask}
                  onPostpone={onPostpone}
                />
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Create modal */}
      {createOpen && (
        <TaskFormModal
          date={selectedDate}
          isAdmin={isAdmin}
          onSave={onAdd}
          onClose={() => setCreateOpen(false)}
        />
      )}

      {/* Edit modal */}
      {editingTask && (
        <TaskFormModal
          task={editingTask}
          date={selectedDate}
          isAdmin={isAdmin}
          onSave={(data) => onUpdate(editingTask.id, data)}
          onClose={() => setEditingTask(null)}
        />
      )}
    </>
  );
}
