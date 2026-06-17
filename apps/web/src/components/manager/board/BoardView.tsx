'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCorners,
  type DragStartEvent, type DragEndEvent, type CollisionDetection,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CalendarDays, Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { popLayer } from '../../../lib/motion';
import { Task, SubtaskItem, toDateStr, getTasksForDate, completionKey } from '../../../lib/tasks';
import type { Tag } from '../../../lib/tags';
import { useDayWeather } from '../../../lib/weather';
import { useHolidays } from '../../../lib/holidays';
import { useWeatherShownLock } from '../../../lib/weatherLock';
import { useAuthStore } from '../../../store/authStore';
import {
  boardApi, BoardColumn as Col, BoardCard, BoardPlacement, BoardTask,
  DEFAULT_COLUMNS, MAX_COLUMNS, buildBoardCards, taskCardKey, subCardKey, placementKey,
} from '../../../lib/board';
import { TaskFormModal } from '../task-form';
import { SubtaskViewModal } from '../SubtaskViewModal';
import { BoxDateCalendar } from '../box/BoxDateCalendar';
import { BoardColumn } from './BoardColumn';
import { CardFace, GroupFace, type DragData } from './BoardCard';
import styles from './BoardView.module.scss';

interface BoardState { columns: Col[]; placements: BoardPlacement[] }

const WEEKDAYS = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
const MONTHS_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

/** Перетаскивание колонок целится только в колонки, карточек — только в карточки/тела. */
const collision: CollisionDetection = (args) => {
  const isCol = String(args.active?.id ?? '').startsWith('col:');
  const droppableContainers = args.droppableContainers.filter(c =>
    isCol ? String(c.id).startsWith('col:') : !String(c.id).startsWith('col:'));
  return closestCorners({ ...args, droppableContainers });
};

/** Позиции (order) для вставки n карточек в `list` на позицию index. */
function positionsAt(list: BoardCard[], index: number, n: number): number[] {
  const prev = list[index - 1];
  const next = list[index];
  const prevO = prev ? prev.order : (next ? next.order - 1 : 0);
  const nextO = next ? next.order : prevO + n + 1;
  const step = (nextO - prevO) / (n + 1);
  return Array.from({ length: n }, (_, i) => prevO + step * (i + 1));
}

/** Индекс вставки в `list` относительно overCard (с учётом «ниже середины» → после). */
function dropIndex(list: BoardCard[], overCard: BoardCard | null, after: boolean): number {
  if (!overCard) return list.length;
  const i = list.findIndex(c => c.key === overCard.key);
  if (i < 0) return list.length;
  return i + (after ? 1 : 0);
}

interface Props {
  tasks: Task[];
  completions: Set<string>;
  selectedDate: Date;
  isAdmin: boolean;
  userTags: Tag[];
  onSelectDate: (d: Date) => void;
  onToggleTask: (taskId: string, date: string) => void;
  onSetSubtaskDone: (taskId: string, date: string, itemId: string, done: boolean) => void;
  onSetAllSubtasksDone: (taskId: string, date: string, done: boolean) => void;
  onCreateTask: (data: Omit<Task, 'id' | 'status'>) => Promise<Task>;
  onUpdate: (id: string, data: Omit<Task, 'id' | 'status'>) => void;
  onDeleteTask: (id: string) => void;
  onCreateTag?: (name: string, color: string, icon?: string | null) => Promise<Tag>;
  onUpdateSubtask: (taskId: string, item: SubtaskItem) => void;
  onDeleteSubtask: (taskId: string, itemId: string) => void;
}

export function BoardView(props: Props) {
  const {
    tasks, completions, selectedDate, isAdmin, userTags, onSelectDate,
    onToggleTask, onSetSubtaskDone, onSetAllSubtasksDone,
    onCreateTask, onUpdate, onDeleteTask, onCreateTag, onUpdateSubtask, onDeleteSubtask,
  } = props;

  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);

  const { data: board } = useQuery({ queryKey: ['board'], queryFn: boardApi.getState });
  const columns = board?.columns?.length ? board.columns : DEFAULT_COLUMNS;
  const placements = useMemo(() => {
    const m = new Map<string, { columnId: string; position: number }>();
    for (const p of board?.placements ?? []) m.set(placementKey(p.cardKey, p.date), { columnId: p.columnId, position: p.position });
    return m;
  }, [board]);

  // ── Набор задач дня + будущие обязательные (как в списке) ──
  const selectedStr = toDateStr(selectedDate);
  const todayStr = toDateStr(new Date());
  const location = { lat: user?.locationLat, lon: user?.locationLon, name: user?.location };
  const { data: dayWeatherData } = useDayWeather(selectedStr, location);
  const showHolidays = user?.showHolidays !== false;
  const { data: holData } = useHolidays(selectedDate.getFullYear(), showHolidays);
  const weatherShownLock = useWeatherShownLock();
  const condHolidayMap = holData && showHolidays ? new Map(holData.map(e => [e.date, e])) : null;
  const condWeatherMap = dayWeatherData
    ? new Map([[selectedStr, { tempMax: dayWeatherData.tempMax, tempMin: dayWeatherData.tempMin, weatherCode: dayWeatherData.weatherCode }]])
    : null;

  const boardTasks = useMemo<BoardTask[]>(() => {
    const occ = getTasksForDate(tasks, selectedDate, completions, condHolidayMap, condWeatherMap, { todayStr, weatherShownLock });
    const dayList = occ.map(o => ({ task: tasks.find(t => t.id === o.id) ?? o, date: selectedStr }));
    const future = tasks
      .filter(t => t.type === 'mandatory' && !!t.date && t.date > selectedStr)
      .map(t => ({ task: t, date: t.date as string }));
    return [...dayList, ...future];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, selectedStr, todayStr, completions, holData, dayWeatherData, weatherShownLock]);

  const cards = useMemo(() => buildBoardCards(boardTasks, completions, placements, columns), [boardTasks, completions, placements, columns]);
  const cardByKey = useMemo(() => new Map(cards.map(c => [c.key, c])), [cards]);
  const cardsByCol = useMemo(() => {
    const m = new Map<string, BoardCard[]>();
    for (const c of columns) m.set(c.id, []);
    for (const card of cards) (m.get(card.columnId) ?? m.set(card.columnId, []).get(card.columnId)!).push(card);
    for (const arr of m.values()) arr.sort((a, b) => a.order - b.order);
    return m;
  }, [cards, columns]);

  const columnItems = useMemo(() => columns.map(c => `col:${c.id}`), [columns]);

  // ── Мутации (оптимистично применяем СИНХРОННО до перерисовки — иначе карточка
  //    «возвращается» на старое место и телепортируется) ─────────────
  const applyPlacementLocal = (v: BoardPlacement) => {
    qc.setQueryData<BoardState>(['board'], old => old
      ? { ...old, placements: [...old.placements.filter(p => !(p.cardKey === v.cardKey && p.date === v.date)), v] }
      : old);
  };
  const applyColumnsLocal = (cols: Col[]) => {
    qc.setQueryData<BoardState>(['board'], old => old ? { ...old, columns: cols } : { columns: cols, placements: [] });
  };
  const setPlacementMut = useMutation({
    mutationFn: (v: BoardPlacement) => boardApi.setPlacement(v),
    onSettled: () => qc.invalidateQueries({ queryKey: ['board'] }),
  });
  const setColumnsMut = useMutation({
    mutationFn: (cols: Col[]) => boardApi.setColumns(cols),
    onSettled: () => qc.invalidateQueries({ queryKey: ['board'] }),
  });
  const placeCard = (v: BoardPlacement) => { applyPlacementLocal(v); setPlacementMut.mutate(v); };
  const saveColumns = (cols: Col[]) => { applyColumnsLocal(cols); setColumnsMut.mutate(cols); };

  // ── DnD ───────────────────────────────────────────────────────
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  type ActiveDrag =
    | { type: 'card'; card: BoardCard }
    | { type: 'group'; task: Task; count: number }
    | { type: 'column'; label: string };
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);

  const clearDrag = () => setActiveDrag(null);

  const resolveDrop = (overId: string): { columnId: string; overCard: BoardCard | null } | null => {
    if (overId.startsWith('body:')) return { columnId: overId.slice(5), overCard: null };
    if (overId.startsWith('col:')) return { columnId: overId.slice(4), overCard: null };
    const oc = cardByKey.get(overId);
    return oc ? { columnId: oc.columnId, overCard: oc } : null;
  };

  const onDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as DragData | undefined;
    if (!data) return;
    if (data.kind === 'card') {
      const card = cardByKey.get(e.active.id as string);
      if (card) setActiveDrag({ type: 'card', card });
    } else if (data.kind === 'group') {
      const task = tasks.find(t => t.id === data.taskId);
      if (task) setActiveDrag({ type: 'group', task, count: data.itemIds.length });
    } else {
      setActiveDrag({ type: 'column', label: data.label });
    }
  };

  // Курсор ниже середины целевой карточки → вставка ПОСЛЕ неё (иначе нельзя
  // положить в самый низ — over всегда был бы последней карточкой = «перед»).
  const isBelowOver = (e: DragEndEvent): boolean => {
    const overRect = e.over?.rect;
    const translated = e.active.rect.current.translated;
    if (!overRect || !translated) return false;
    return translated.top + translated.height / 2 > overRect.top + overRect.height / 2;
  };

  // Никаких setState во время перетаскивания: всё считаем по точке сброса (`over`)
  // в onDragEnd. Живой «зазор» внутри колонки рисует сам SortableContext.
  const onDragEnd = (e: DragEndEvent) => {
    const data = e.active.data.current as DragData | undefined;
    const overId = e.over?.id as string | undefined;
    clearDrag();
    if (!data) return;

    // Колонки
    if (data.kind === 'column') {
      if (overId && overId.startsWith('col:')) {
        const from = columns.findIndex(c => c.id === data.columnId);
        const to = columns.findIndex(c => c.id === overId.slice(4));
        if (from >= 0 && to >= 0 && from !== to) saveColumns(arrayMove(columns, from, to));
      }
      return;
    }

    const drop = overId ? resolveDrop(overId) : null;
    const target = drop ? columns.find(c => c.id === drop.columnId) : undefined;
    if (!drop || !target) return;

    // Группа целиком
    if (data.kind === 'group') {
      const list = (cardsByCol.get(target.id) ?? []).filter(c => !(c.kind === 'subtask' && c.task.id === data.taskId));
      const positions = positionsAt(list, dropIndex(list, drop.overCard, isBelowOver(e)), data.itemIds.length);
      if (target.role === 'done') onSetAllSubtasksDone(data.taskId, data.date, true);
      data.itemIds.forEach((itemId, i) => {
        if (target.role !== 'done') onSetSubtaskDone(data.taskId, data.date, itemId, false);
        placeCard({ cardKey: subCardKey(data.taskId, itemId), date: data.date, columnId: target.id, position: positions[i] });
      });
      return;
    }

    // Карточка
    const activeKey = e.active.id as string;
    const overCard = drop.overCard && drop.overCard.key !== activeKey ? drop.overCard : null;
    const list = (cardsByCol.get(target.id) ?? []).filter(c => c.key !== activeKey);
    const [pos] = positionsAt(list, dropIndex(list, overCard, isBelowOver(e)), 1);

    if (data.cardType === 'task') {
      const done = completions.has(completionKey(data.taskId, data.date));
      if (target.role === 'done' && !done) onToggleTask(data.taskId, data.date);
      if (target.role !== 'done' && done) onToggleTask(data.taskId, data.date);
    } else if (data.itemId) {
      onSetSubtaskDone(data.taskId, data.date, data.itemId, target.role === 'done');
    }
    placeCard({ cardKey: activeKey, date: data.date, columnId: target.id, position: pos });
  };

  // ── Создание задачи в колонке ─────────────────────────────────
  const handleAdd = async (columnId: string, title: string) => {
    const task = await onCreateTask({ title, date: selectedStr, repeat: 'none', type: 'normal', priority: 'none' });
    const col = columns.find(c => c.id === columnId);
    if (!col) return;
    if (col.role === 'done') { onToggleTask(task.id, selectedStr); return; }
    if (col.role !== 'todo') {
      const existing = cardsByCol.get(columnId) ?? [];
      const last = existing.length ? existing[existing.length - 1].order : 0;
      placeCard({ cardKey: taskCardKey(task.id), date: selectedStr, columnId, position: last + 1 });
    }
  };

  // ── Колонки: добавить / переименовать / удалить ───────────────
  const canAdd = columns.length < MAX_COLUMNS;
  const addColumn = () => {
    const newCol: Col = { id: `custom_${Date.now()}`, name: 'Новая колонка', role: 'custom' };
    saveColumns([...columns, newCol]);
  };
  const renameColumn = (id: string, name: string) => saveColumns(columns.map(c => c.id === id ? { ...c, name } : c));
  const setColumnColor = (id: string, color: string) => saveColumns(columns.map(c => c.id === id ? { ...c, color } : c));
  const deleteColumn = (id: string) => saveColumns(columns.filter(c => c.id !== id));

  // ── Открытие задачи / подзадачи ───────────────────────────────
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingSub, setViewingSub] = useState<{ taskId: string; date: string; item: SubtaskItem } | null>(null);

  const openTask = (card: BoardCard) => setEditingTask(card.task);
  const openSubtask = (card: BoardCard) => {
    if (card.kind === 'subtask') setViewingSub({ taskId: card.task.id, date: card.date, item: card.item });
  };

  // ── Заголовок-день (кликабельный) ─────────────────────────────
  const [dayOpen, setDayOpen] = useState(false);
  const dayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!dayOpen) return;
    const h = (e: MouseEvent) => { if (dayRef.current && !dayRef.current.contains(e.target as Node)) setDayOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [dayOpen]);
  const isToday = selectedStr === todayStr;
  const dayLabel = `${WEEKDAYS[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTHS_GEN[selectedDate.getMonth()]}`;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.dayWrap} ref={dayRef}>
          <button type="button" className={styles.dayBtn} onClick={() => setDayOpen(v => !v)}>
            <CalendarDays size={18} strokeWidth={1.75} />
            <span className={styles.dayTitle}>{isToday ? 'Сегодня' : dayLabel}</span>
            {isToday && <span className={styles.daySub}>{dayLabel}</span>}
          </button>
          <AnimatePresence>
            {dayOpen && (
              <motion.div className={styles.dayPop} variants={popLayer} initial="hidden" animate="visible" exit="exit">
                <BoxDateCalendar value={selectedStr} onChange={(iso) => { onSelectDate(new Date(iso + 'T00:00:00')); setDayOpen(false); }} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={collision}
        onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={clearDrag}>
        <div className={styles.columns}>
          <SortableContext items={columnItems} strategy={horizontalListSortingStrategy}>
            {columns.map(col => (
              <BoardColumn
                key={col.id}
                column={col}
                cards={cardsByCol.get(col.id) ?? []}
                onRename={(name) => renameColumn(col.id, name)}
                onSetColor={(color) => setColumnColor(col.id, color)}
                onDelete={col.role === 'custom' ? () => deleteColumn(col.id) : undefined}
                onOpenTask={openTask}
                onOpenSubtask={openSubtask}
                onAdd={(title) => handleAdd(col.id, title)}
              />
            ))}
          </SortableContext>
          {canAdd && (
            <button type="button" className={styles.addColumn} onClick={addColumn}>
              <Plus size={16} strokeWidth={2} /> Колонка
            </button>
          )}
        </div>

        <DragOverlay>
          {activeDrag?.type === 'card' && (
            <div className={styles.card} style={{ width: 266, boxShadow: 'var(--shadow-pop)', cursor: 'grabbing' }}>
              <div className={styles.cardInner}><CardFace card={activeDrag.card} /></div>
            </div>
          )}
          {activeDrag?.type === 'group' && (
            <div className={styles.group} style={{ width: 266, boxShadow: 'var(--shadow-pop)', cursor: 'grabbing' }}>
              <GroupFace task={activeDrag.task} count={activeDrag.count} />
            </div>
          )}
          {activeDrag?.type === 'column' && (
            <div className={styles.colOverlay}>{activeDrag.label}</div>
          )}
        </DragOverlay>
      </DndContext>

      {editingTask && (
        <TaskFormModal
          task={editingTask}
          date={selectedDate}
          isAdmin={isAdmin}
          userTags={userTags}
          onSave={(data) => { onUpdate(editingTask.id, data); setEditingTask(null); }}
          onClose={() => setEditingTask(null)}
          onDelete={() => { onDeleteTask(editingTask.id); setEditingTask(null); }}
          onCreateTag={onCreateTag}
        />
      )}

      {viewingSub && (
        <SubtaskViewModal
          item={viewingSub.item}
          userTags={userTags}
          onClose={() => setViewingSub(null)}
          onToggle={() => onSetSubtaskDone(viewingSub.taskId, viewingSub.date, viewingSub.item.id, !viewingSub.item.done)}
          onEdit={() => {
            const base = tasks.find(t => t.id === viewingSub.taskId);
            setViewingSub(null);
            if (base) setEditingTask(base);
          }}
          onUpdate={(item) => { onUpdateSubtask(viewingSub.taskId, item); setViewingSub({ ...viewingSub, item }); }}
          onDelete={() => { onDeleteSubtask(viewingSub.taskId, viewingSub.item.id); setViewingSub(null); }}
        />
      )}
    </div>
  );
}
