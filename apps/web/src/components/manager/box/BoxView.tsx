'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Plus, Inbox, X, Tag as TagIcon, Trash2 } from 'lucide-react';
import { popLayer, listContainer } from '../../../lib/motion';
import { Task, TaskType, TaskPriority, toDateStr, completionKey } from '../../../lib/tasks';
import type { Tag } from '../../../lib/tags';
import { Icon, hasIcon } from '../../../lib/icons';
import { Button, IconButton, Input, EmptyState } from '../../ui';
import { TaskFormModal } from '../task-form';
import { MultiFilter, FilterOption } from './MultiFilter';
import { DateFilterField } from './DateFilterField';
import { BoxRow } from './BoxRow';
import {
  BoxFilters, BoxStatus, BoxSortKey, BoxGroupBy,
  EMPTY_FILTERS, hasActiveFilters, matchesFilters, sortTasks, groupTasks,
  nextOccurrenceStr, deriveBoxStatus,
} from './boxLogic';
import styles from './BoxView.module.scss';

const STORE_KEY = 'wt_box_state';

const MONTHS_GEN = ['января','февраля','марта','апреля','мая','июня',
                    'июля','августа','сентября','октября','ноября','декабря'];

function fmtDate(ds: string): string {
  const d = new Date(ds + 'T00:00:00');
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}${sameYear ? '' : ' ' + d.getFullYear()}`;
}

function rowDateLabel(task: Task, repDate: string): string {
  if (task.endDate) return `${fmtDate(task.date ?? '')} — ${fmtDate(task.endDate)}`;
  if (task.repeat && task.repeat !== 'none') return `с ${fmtDate(task.date ?? '')}`;
  if (!repDate) return 'Без даты';
  return fmtDate(repDate);
}

const TYPE_OPTIONS: FilterOption[] = [
  { value: 'normal', label: 'Обычная' },
  { value: 'mandatory', label: 'Обязательная' },
  { value: 'event', label: 'Событие' },
];
const PRIORITY_OPTIONS: FilterOption[] = [
  { value: 'high', label: 'Высокий' },
  { value: 'medium', label: 'Средний' },
  { value: 'low', label: 'Низкий' },
  { value: 'none', label: 'Без приоритета' },
];
const STATUS_OPTIONS: FilterOption[] = [
  { value: 'active', label: 'Активные' },
  { value: 'done', label: 'Выполненные' },
  { value: 'overdue', label: 'Просрочённые' },
];

interface Props {
  tasks: Task[];
  completions: Set<string>;
  userTags: Tag[];
  isAdmin: boolean;
  selectedDate: Date;
  onAdd: (data: Omit<Task, 'id' | 'status'>) => void;
  onUpdate: (id: string, data: Omit<Task, 'id' | 'status'>, occDate?: string) => void;
  onDeleteTask: (id: string) => void;
  onToggle: (id: string, dateStr: string) => void;
  onCreateTag?: (name: string, color: string, icon?: string | null) => Promise<Tag>;
}

export function BoxView({
  tasks, completions, userTags, isAdmin, selectedDate,
  onAdd, onUpdate, onDeleteTask, onToggle, onCreateTag,
}: Props) {
  // ── Persisted view state ────────────────────────────────────
  const [filters, setFilters] = useState<BoxFilters>(EMPTY_FILTERS);
  const [sort, setSort]   = useState<BoxSortKey>('date');
  const [group, setGroup] = useState<BoxGroupBy>('none');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.filters) setFilters({ ...EMPTY_FILTERS, ...s.filters });
        if (s.sort) setSort(s.sort);
        if (s.group) setGroup(s.group);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ filters, sort, group }));
    } catch { /* ignore */ }
  }, [filters, sort, group]);

  // ── Selection / modals ──────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen]   = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const tagMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tagMenuOpen) return;
    const h = (e: MouseEvent) => {
      if (tagMenuRef.current && !tagMenuRef.current.contains(e.target as Node)) setTagMenuOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [tagMenuOpen]);

  const todayStr = toDateStr(new Date());

  // ── Pipeline: filter → sort → group ─────────────────────────
  const filtered = useMemo(
    () => tasks.filter(t => matchesFilters(t, filters, completions, todayStr)),
    [tasks, filters, completions, todayStr],
  );
  const sorted = useMemo(() => sortTasks(filtered, sort, todayStr), [filtered, sort, todayStr]);
  const groups = useMemo(() => groupTasks(sorted, group, todayStr), [sorted, group, todayStr]);

  const update = (patch: Partial<BoxFilters>) => setFilters(f => ({ ...f, ...patch }));

  // ── Presets ─────────────────────────────────────────────────
  const presetOverdue = filters.statuses.includes('overdue');
  const presetToday   = filters.dateFrom === todayStr && filters.dateTo === todayStr;
  const toggleStatus = (s: BoxStatus) =>
    update({ statuses: filters.statuses.includes(s)
      ? filters.statuses.filter(x => x !== s) : [...filters.statuses, s] });

  // ── Selection helpers ───────────────────────────────────────
  const visibleIds = useMemo(() => sorted.map(t => t.id), [sorted]);
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleSelectAll = () => setSelectedIds(allSelected ? new Set() : new Set(visibleIds));
  const clearSelection = () => { setSelectedIds(new Set()); setConfirmDelete(false); setTagMenuOpen(false); };

  // ── Bulk actions ────────────────────────────────────────────
  const stripRuntime = (t: Task): Omit<Task, 'id' | 'status'> => {
    const { id: _i, status: _s, occurrenceDate: _o, weatherWarning: _w, ...rest } = t;
    void _i; void _s; void _o; void _w;
    return rest;
  };
  const bulkAddTag = (tag: Tag) => {
    for (const id of selectedIds) {
      const task = tasks.find(t => t.id === id);
      if (!task) continue;
      if ((task.tags ?? []).some(t => t.id === tag.id)) continue;
      onUpdate(id, { ...stripRuntime(task), tags: [...(task.tags ?? []), tag] });
    }
    setTagMenuOpen(false);
    clearSelection();
  };
  const bulkDelete = () => {
    for (const id of selectedIds) onDeleteTask(id);
    clearSelection();
  };

  const rowCompleteDate = (task: Task) => nextOccurrenceStr(task, todayStr);

  // ── Empty states ────────────────────────────────────────────
  if (tasks.length === 0) {
    return (
      <div className={styles.root}>
        <div className={styles.emptyWrap}>
          <EmptyState
            size="lg"
            icon={<Inbox size={48} strokeWidth={1.25} />}
            title="Коробка пуста"
            description="Здесь собираются все созданные задачи. Создайте первую."
            action={
              <Button variant="accent" size="sm" leftIcon={<Plus size={16} strokeWidth={2} />}
                onClick={() => setCreateOpen(true)}>
                Создать задачу
              </Button>
            }
          />
        </div>
        {createOpen && (
          <TaskFormModal date={selectedDate} isAdmin={isAdmin} userTags={userTags}
            onSave={onAdd} onClose={() => setCreateOpen(false)} onCreateTag={onCreateTag} />
        )}
      </div>
    );
  }

  const tagOptions: FilterOption[] = userTags.map(t => ({ value: t.id, label: t.name, dot: t.color }));

  return (
    <div className={styles.root}>
      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarTop}>
          <Input
            size="sm"
            placeholder="Поиск по задачам…"
            prefix={<Search size={15} strokeWidth={2} />}
            value={filters.search}
            onChange={e => update({ search: e.target.value })}
            wrapClassName={styles.search}
          />
          <div className={styles.selects}>
            <select className={styles.select} value={sort} onChange={e => setSort(e.target.value as BoxSortKey)} aria-label="Сортировка">
              <option value="date">По дате</option>
              <option value="title">По названию</option>
              <option value="priority">По приоритету</option>
            </select>
            <select className={styles.select} value={group} onChange={e => setGroup(e.target.value as BoxGroupBy)} aria-label="Группировка">
              <option value="none">Без групп</option>
              <option value="tag">По тегам</option>
              <option value="type">По типу</option>
              <option value="month">По месяцам</option>
            </select>
          </div>
          <Button variant="accent" size="sm" leftIcon={<Plus size={16} strokeWidth={2} />}
            onClick={() => setCreateOpen(true)}>
            Создать
          </Button>
        </div>

        <div className={styles.toolbarFilters}>
          {tagOptions.length > 0 && (
            <MultiFilter label="Теги" options={tagOptions} selected={filters.tagIds}
              onChange={v => update({ tagIds: v })} />
          )}
          <MultiFilter label="Тип" options={TYPE_OPTIONS} selected={filters.types}
            onChange={v => update({ types: v as TaskType[] })} />
          <MultiFilter label="Приоритет" options={PRIORITY_OPTIONS} selected={filters.priorities}
            onChange={v => update({ priorities: v as TaskPriority[] })} />
          <MultiFilter label="Статус" options={STATUS_OPTIONS} selected={filters.statuses}
            onChange={v => update({ statuses: v as BoxStatus[] })} />

          <div className={styles.dateRange}>
            <DateFilterField value={filters.dateFrom} placeholder="С даты"
              onChange={v => update({ dateFrom: v })} />
            <span className={styles.dateDash}>—</span>
            <DateFilterField value={filters.dateTo} placeholder="По дату"
              onChange={v => update({ dateTo: v })} />
          </div>

          {hasActiveFilters(filters) && (
            <button type="button" className={styles.reset} onClick={() => setFilters(EMPTY_FILTERS)}>
              <X size={13} strokeWidth={2} /> Сбросить
            </button>
          )}
        </div>

        {/* Presets */}
        <div className={styles.presets}>
          <button type="button" className={[styles.preset, presetOverdue ? styles.presetOn : ''].join(' ')}
            onClick={() => toggleStatus('overdue')}>Просрочённые</button>
          <button type="button" className={[styles.preset, presetToday ? styles.presetOn : ''].join(' ')}
            onClick={() => presetToday ? update({ dateFrom: '', dateTo: '' }) : update({ dateFrom: todayStr, dateTo: todayStr })}>Сегодня</button>
          <button type="button" className={[styles.preset, filters.noTags ? styles.presetOn : ''].join(' ')}
            onClick={() => update({ noTags: !filters.noTags })}>Без тегов</button>
          <button type="button" className={[styles.preset, filters.repeatOnly ? styles.presetOn : ''].join(' ')}
            onClick={() => update({ repeatOnly: !filters.repeatOnly })}>Повторяющиеся</button>
        </div>
      </div>

      {/* ── Results bar ── */}
      <div className={styles.resultsBar}>
        <button type="button" className={[styles.selectBox, allSelected ? styles.selectBoxOn : ''].join(' ')}
          onClick={toggleSelectAll} aria-label="Выбрать все" role="checkbox" aria-checked={allSelected}>
          {allSelected && '✓'}
        </button>
        <span className={styles.count}>{sorted.length} {plural(sorted.length)}</span>
      </div>

      {/* ── List ── */}
      <div className={styles.listScroll}>
        {sorted.length === 0 ? (
          <div className={styles.emptyWrap}>
            <EmptyState size="md" icon={<Search size={40} strokeWidth={1.25} />}
              title="Ничего не найдено"
              description="Под выбранные фильтры нет задач."
              action={<Button variant="secondary" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>Сбросить фильтры</Button>}
            />
          </div>
        ) : (
          groups.map(g => (
            <div key={g.key} className={styles.group}>
              {g.label && <div className={styles.groupHead}>{g.label}<span className={styles.groupCount}>{g.tasks.length}</span></div>}
              <motion.ul className={styles.list} variants={listContainer} initial="hidden" animate="visible">
                {g.tasks.map(task => {
                  const repDate = rowCompleteDate(task);
                  return (
                    <BoxRow
                      key={task.id}
                      task={task}
                      repDate={repDate}
                      dateLabel={rowDateLabel(task, repDate)}
                      isDone={completions.has(completionKey(task.id, repDate))}
                      status={deriveBoxStatus(task, completions, todayStr)}
                      selected={selectedIds.has(task.id)}
                      onSelectToggle={() => toggleSelect(task.id)}
                      onComplete={() => onToggle(task.id, repDate)}
                      onEdit={() => setEditingTask(task)}
                      onDelete={() => onDeleteTask(task.id)}
                    />
                  );
                })}
              </motion.ul>
            </div>
          ))
        )}
      </div>

      {/* ── Bulk action bar ── */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div className={styles.bulkBar}
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            transition={{ duration: 0.18 }}>
            <span className={styles.bulkCount}>Выбрано {selectedIds.size}</span>
            <div className={styles.bulkActions}>
              <div className={styles.tagMenuWrap} ref={tagMenuRef}>
                <Button variant="secondary" size="sm" leftIcon={<TagIcon size={14} strokeWidth={2} />}
                  onClick={() => setTagMenuOpen(v => !v)} disabled={userTags.length === 0}>
                  Тег
                </Button>
                <AnimatePresence>
                  {tagMenuOpen && (
                    <motion.div className={styles.tagMenu}
                      variants={popLayer} initial="hidden" animate="visible" exit="exit">
                      {userTags.map(tag => (
                        <button key={tag.id} type="button" className={styles.tagMenuItem} onClick={() => bulkAddTag(tag)}>
                          {hasIcon(tag.icon)
                            ? <Icon name={tag.icon!} size={12} strokeWidth={2.5} />
                            : <span className={styles.tagDot} style={{ background: tag.color }} />}
                          {tag.name}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {confirmDelete ? (
                <div className={styles.confirmRow}>
                  <span>Удалить {selectedIds.size}?</span>
                  <Button variant="destructive" size="sm" onClick={bulkDelete}>Да</Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Нет</Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" leftIcon={<Trash2 size={14} strokeWidth={2} />}
                  onClick={() => setConfirmDelete(true)}>
                  Удалить
                </Button>
              )}
              <IconButton icon={<X size={16} strokeWidth={2} />} aria-label="Снять выбор"
                variant="ghost" size="sm" onClick={clearSelection} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modals ── */}
      {createOpen && (
        <TaskFormModal date={selectedDate} isAdmin={isAdmin} userTags={userTags}
          onSave={onAdd} onClose={() => setCreateOpen(false)} onCreateTag={onCreateTag} />
      )}
      {editingTask && (
        <TaskFormModal task={editingTask} date={selectedDate} isAdmin={isAdmin} userTags={userTags}
          onSave={(data) => { onUpdate(editingTask.id, data); setEditingTask(null); }}
          onClose={() => setEditingTask(null)}
          onDelete={() => { onDeleteTask(editingTask.id); setEditingTask(null); }}
          onCreateTag={onCreateTag} />
      )}
    </div>
  );
}

function plural(n: number): string {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'задача';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'задачи';
  return 'задач';
}
