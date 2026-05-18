'use client';

import { useEffect, useRef, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Task, TaskStatus, toDateStr, getTasksForDate, completionKey } from '../../lib/tasks';
import type { Tag } from '../../lib/tags';
import { TaskFormModal } from './TaskFormModal';
import { useCurrentWeather, useDayWeather, weatherCodeToInfo } from '../../lib/weather';
import { useAuthStore } from '../../store/authStore';
import { useHolidays, getHolidayName } from '../../lib/holidays';
import styles from './TaskList.module.scss';

type LucideIcon = React.ComponentType<{ size?: number; strokeWidth?: number }>;
const Icons = LucideIcons as unknown as Record<string, LucideIcon>;

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
  isMandatoryDay?: boolean;
  hidePostpone?: boolean;
  onToggle: (id: string, dateStr: string) => void;
  onDelete: (id: string) => void;
  onEdit:   (task: Task) => void;
  onPostpone: (id: string, days: number) => void;
}

function TaskItem({ task, dateStr, dateLabel, isMandatoryDay, hidePostpone, onToggle, onDelete, onEdit, onPostpone }: TaskItemProps) {
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

  if (task.isGlobal) {
    return (
      <li className={[styles.task, styles.taskGlobal].join(' ')}>
        <span className={styles.globalIcon} title="Глобальное событие">
          {(() => { const Ic = Icons[task.icon ?? '']; return Ic ? <Ic size={15} strokeWidth={1.75} /> : (task.icon || '🌐'); })()}
        </span>
        <div className={styles.taskBody}>
          {task.time && <span className={styles.taskTime}>{task.time}</span>}
          <div className={styles.taskText}>
            <span className={styles.taskTitle}>{task.title}</span>
            {task.description && <span className={styles.taskDesc}>{task.description}</span>}
          </div>
          {task.repeat !== 'none' && (
            <span className={styles.repeatBadge} title={`Повтор: ${task.repeat}`}>
              {task.repeat === 'daily' && '↻д'}{task.repeat === 'weekly' && '↻н'}
              {task.repeat === 'monthly' && '↻м'}{task.repeat === 'yearly' && '↻г'}
            </span>
          )}
        </div>
      </li>
    );
  }

  const taskIcon = task.icon ? Icons[task.icon] : null;

  return (
    <li className={[
      styles.task,
      styles[`task_${task.status}`],
      isMandatoryDay ? styles.taskMandatoryDay : '',
      (menuOpen || postponeOpen) ? styles.taskMenuOpen : '',
    ].join(' ')}>
      {/* Иконка задачи (если есть) */}
      {taskIcon && (
        <span className={styles.taskIcon}>
          {(() => { const Ic = taskIcon; return <Ic size={14} strokeWidth={1.75} />; })()}
        </span>
      )}

      {/* Checkbox */}
      <button
        className={[
          styles.checkbox,
          task.status === 'done'   ? styles.checkboxDone   : '',
          task.status === 'missed' ? styles.checkboxMissed : '',
        ].join(' ')}
        onClick={e => { e.stopPropagation(); onToggle(task.id, dateStr); }}
        aria-label={task.status === 'done' ? 'Снять отметку' : 'Отметить выполненным'}
      >
        {task.status === 'done'   && '✓'}
        {task.status === 'missed' && '✕'}
      </button>

      {/* Body — кликабельно для открытия редактора */}
      <div className={styles.taskBody} onClick={() => onEdit(task)} role="button" tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onEdit(task); }}>
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
        {task.tags?.slice(0, 2).map(tag => {
          const Ic = tag.icon ? Icons[tag.icon] : null;
          return (
            <span key={tag.id} className={styles.taskTag} style={{ borderColor: tag.color }}>
              {Ic ? <Ic size={9} strokeWidth={2.5} /> : <span className={styles.taskTagDot} style={{ background: tag.color }} />}
            </span>
          );
        })}
      </div>

      {/* Menu */}
      <div className={styles.menuWrap} ref={menuRef}>
        <button className={styles.menuBtn} onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}>···</button>

        {menuOpen && (
          <div className={styles.menu}>
            {/* Перенести + submenu */}
            {!hidePostpone && (
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
                    {task.type !== 'mandatory' && [
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
                    {task.type !== 'mandatory' && <div className={styles.submenuDivider} />}
                    <button
                      className={styles.submenuItem}
                      onClick={() => { onEdit(task); close(); }}
                    >
                      Другое...
                    </button>
                  </div>
                )}
              </div>
            )}

            {!hidePostpone && <div className={styles.menuDivider} />}
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
  userTags: Tag[];
  onToggle:   (id: string, dateStr: string) => void;
  onDelete:   (id: string) => void;
  onAdd:      (data: Omit<Task, 'id' | 'status'>) => void;
  onUpdate:   (id: string, data: Omit<Task, 'id' | 'status'>) => void;
  onPostpone: (id: string, days: number) => void;
  onGoToToday: () => void;
}

export function TaskList({
  selectedDate, tasks, completions, isAdmin, userTags,
  onToggle, onDelete, onAdd, onUpdate, onPostpone, onGoToToday,
}: Props) {
  const [now,         setNow]         = useState(new Date());
  const [createOpen,  setCreateOpen]  = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const user     = useAuthStore(s => s.user);
  const location = { lat: user?.locationLat, lon: user?.locationLon, name: user?.location };
  const { data: currentWeather } = useCurrentWeather(location);
  const { data: dayWeatherData } = useDayWeather(toDateStr(selectedDate), location);

  const showHolidays = user?.showHolidays !== false;
  const { data: holData } = useHolidays(selectedDate.getFullYear(), showHolidays);
  const holidayEntry = holData?.find(e => e.date === toDateStr(selectedDate));
  const holidayName  = showHolidays && holidayEntry?.type === 'holiday'
    ? (holidayEntry.name || getHolidayName(holidayEntry.date)) : null;

  const selectedStr = toDateStr(selectedDate);

  const condHolidayMap = holData && showHolidays
    ? new Map(holData.map(e => [e.date, e]))
    : null;
  const condWeatherMap = dayWeatherData
    ? new Map([[selectedStr, { tempMax: dayWeatherData.tempMax, tempMin: dayWeatherData.tempMin, weatherCode: dayWeatherData.weatherCode }]])
    : null;

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const isToday     = selectedStr === toDateStr(new Date());

  const dayTasks = getTasksForDate(tasks, selectedDate, completions, condHolidayMap, condWeatherMap);

  // Future section: mandatory tasks ahead, excluding already completed ones
  const futureTasks = tasks
    .filter(t => t.date > selectedStr && t.type === 'mandatory')
    .map(t => {
      const status: TaskStatus = completions.has(completionKey(t.id, t.date)) ? 'done' : 'pending';
      return { ...t, status };
    })
    .filter(t => t.status !== 'done')
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''))
    .slice(0, 6);

  const dateLabel = isToday
    ? 'Сегодня'
    : selectedDate.toLocaleDateString('ru', { day: 'numeric', month: 'long' });

  return (
    <>
      <div className={styles.root}>
        {/* Clock + текущая погода */}
        <div className={styles.clockRow}>
          <div className={styles.clock} onClick={onGoToToday} title="Вернуться к сегодня" role="button" tabIndex={0}>
            <span className={styles.clockTime}>{pad(now.getHours())}:{pad(now.getMinutes())}</span>
            <span className={styles.clockDay}>{DAY_SHORT[now.getDay()]}</span>
          </div>
          {currentWeather && (() => {
            const { icon } = weatherCodeToInfo(currentWeather.weatherCode);
            const WeatherIc = Icons[icon];
            return (
              <div className={styles.clockWeather}>
                {WeatherIc && <WeatherIc size={16} strokeWidth={1.5} />}
                <span className={styles.clockTemp}>
                  {currentWeather.temp > 0 ? '+' : ''}{currentWeather.temp}°
                </span>
              </div>
            );
          })()}
        </div>

        {/* Day tasks */}
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionLabel}>{dateLabel}</span>
            <button className={styles.addBtn} onClick={() => setCreateOpen(true)} title="Добавить задачу">+</button>
          </div>

          {holidayName && (
            <div className={styles.holidayBanner}>{holidayName}</div>
          )}

          {dayTasks.length === 0 ? (
            <p className={styles.empty}>Нет задач на этот день</p>
          ) : (
            <ul className={styles.list}>
              {dayTasks.map(t => (
                <TaskItem
                  key={t.id}
                  task={t}
                  dateStr={selectedStr}
                  isMandatoryDay={t.type === 'mandatory' && t.date === selectedStr}
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
                  hidePostpone
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
          userTags={userTags}
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
          userTags={userTags}
          onSave={(data) => onUpdate(editingTask.id, data)}
          onClose={() => setEditingTask(null)}
          onDelete={() => { onDelete(editingTask.id); setEditingTask(null); }}
        />
      )}
    </>
  );
}
