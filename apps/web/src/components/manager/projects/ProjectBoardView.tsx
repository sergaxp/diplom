'use client';

import { useMemo, useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCorners,
  type DragStartEvent, type DragEndEvent, type CollisionDetection,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { Task, SubtaskItem, completionKey } from '../../../lib/tasks';
import type { Tag } from '../../../lib/tags';
import {
  BoardCard, BoardColumn as Col, buildBoardCards, taskCardKey, subCardKey, placementKey,
  MAX_COLUMNS,
} from '../../../lib/board';
import { Project, isAutoArchived } from '../../../lib/projects';
import { TaskFormModal } from '../task-form';
import { SubtaskViewModal } from '../SubtaskViewModal';
import { BoardColumn } from '../board/BoardColumn';
import { CardFace, GroupFace, type DragData } from '../board/BoardCard';
import { useProjectBoard } from './useProjectBoard';
import boardStyles from '../board/BoardView.module.scss';
import styles from './ProjectBoardView.module.scss';

/** Псевдо-дата: доска проекта плоская (карточка = задача один раз), но
 *  buildBoardCards/placementKey/completionKey ключуются по дате — даём общий
 *  ключ. В placement проекта дата не хранится (только cardKey). */
const SCOPE = '';

/** Перетаскивание колонок целится только в колонки, карточек — только в карточки/тела. */
const collision: CollisionDetection = (args) => {
  const isCol = String(args.active?.id ?? '').startsWith('col:');
  const droppableContainers = args.droppableContainers.filter(c =>
    isCol ? String(c.id).startsWith('col:') : !String(c.id).startsWith('col:'));
  return closestCorners({ ...args, droppableContainers });
};

function positionsAt(list: BoardCard[], index: number, n: number): number[] {
  const prev = list[index - 1];
  const next = list[index];
  const prevO = prev ? prev.order : (next ? next.order - 1 : 0);
  const nextO = next ? next.order : prevO + n + 1;
  const step = (nextO - prevO) / (n + 1);
  return Array.from({ length: n }, (_, i) => prevO + step * (i + 1));
}

function dropIndex(list: BoardCard[], overCard: BoardCard | null, after: boolean): number {
  if (!overCard) return list.length;
  const i = list.findIndex(c => c.key === overCard.key);
  if (i < 0) return list.length;
  return i + (after ? 1 : 0);
}

interface Props {
  project: Project;
  tasks: Task[];                 // все задачи пользователя (фильтруем по проекту)
  userTags: Tag[];
  isAdmin: boolean;
  activeMilestone: string | 'all' | 'none';
  showArchive: boolean;
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

export function ProjectBoardView(props: Props) {
  const {
    project, tasks, userTags, isAdmin, activeMilestone, showArchive,
    onCreateTask, onUpdateTask, onDeleteTask, onSetTaskDone,
    onSetSubtaskDone, onSetAllSubtasksDone, onUpdateSubtask, onDeleteSubtask, onCreateTag,
  } = props;

  const board = useProjectBoard(project.id);
  const { columns, placeCard, saveColumns } = board;

  // Задачи проекта с учётом этапа и архива.
  const projectTasks = useMemo(
    () => tasks.filter(t =>
      t.projectId === project.id &&
      (activeMilestone === 'all' ||
        (activeMilestone === 'none' ? !t.milestoneId : t.milestoneId === activeMilestone)) &&
      (showArchive || !isAutoArchived(t.completedAt))),
    [tasks, project.id, activeMilestone, showArchive],
  );

  const taskById = useMemo(() => new Map(projectTasks.map(t => [t.id, t])), [projectTasks]);

  // ── Карточки (переиспользуем движок дневной доски) ─────────────
  const completions = useMemo(
    () => new Set(projectTasks.filter(t => t.completedAt).map(t => completionKey(t.id, SCOPE))),
    [projectTasks],
  );
  const placementsMap = useMemo(() => {
    const m = new Map<string, { columnId: string; position: number }>();
    for (const p of board.placements.values()) m.set(placementKey(p.cardKey, SCOPE), { columnId: p.columnId, position: p.position });
    return m;
  }, [board.placements]);

  const boardTasks = useMemo(() => projectTasks.map(t => ({ task: t, date: SCOPE })), [projectTasks]);
  const cards = useMemo(() => buildBoardCards(boardTasks, completions, placementsMap, columns), [boardTasks, completions, placementsMap, columns]);
  const cardByKey = useMemo(() => new Map(cards.map(c => [c.key, c])), [cards]);
  const cardsByCol = useMemo(() => {
    const m = new Map<string, BoardCard[]>();
    for (const c of columns) m.set(c.id, []);
    for (const card of cards) (m.get(card.columnId) ?? m.set(card.columnId, []).get(card.columnId)!).push(card);
    for (const arr of m.values()) arr.sort((a, b) => a.order - b.order);
    return m;
  }, [cards, columns]);
  const columnItems = useMemo(() => columns.map(c => `col:${c.id}`), [columns]);

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
      const task = taskById.get(data.taskId);
      if (task) setActiveDrag({ type: 'group', task, count: data.itemIds.length });
    } else {
      setActiveDrag({ type: 'column', label: data.label });
    }
  };

  const isBelowOver = (e: DragEndEvent): boolean => {
    const overRect = e.over?.rect;
    const translated = e.active.rect.current.translated;
    if (!overRect || !translated) return false;
    return translated.top + translated.height / 2 > overRect.top + overRect.height / 2;
  };

  const onDragEnd = (e: DragEndEvent) => {
    const data = e.active.data.current as DragData | undefined;
    const overId = e.over?.id as string | undefined;
    clearDrag();
    if (!data) return;

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
      if (target.role === 'done') onSetAllSubtasksDone(data.taskId, true);
      data.itemIds.forEach((itemId, i) => {
        if (target.role !== 'done') onSetSubtaskDone(data.taskId, itemId, false);
        placeCard({ cardKey: subCardKey(data.taskId, itemId), columnId: target.id, position: positions[i] });
      });
      return;
    }

    // Карточка
    const activeKey = e.active.id as string;
    const overCard = drop.overCard && drop.overCard.key !== activeKey ? drop.overCard : null;
    const list = (cardsByCol.get(target.id) ?? []).filter(c => c.key !== activeKey);
    const [pos] = positionsAt(list, dropIndex(list, overCard, isBelowOver(e)), 1);

    if (data.cardType === 'task') {
      const done = !!taskById.get(data.taskId)?.completedAt;
      if (target.role === 'done' && !done) onSetTaskDone(data.taskId, true);
      if (target.role !== 'done' && done) onSetTaskDone(data.taskId, false);
    } else if (data.itemId) {
      onSetSubtaskDone(data.taskId, data.itemId, target.role === 'done');
    }
    placeCard({ cardKey: activeKey, columnId: target.id, position: pos });
  };

  // ── Создание задачи в колонке ─────────────────────────────────
  const handleAdd = async (columnId: string, title: string) => {
    const milestoneId = activeMilestone !== 'all' && activeMilestone !== 'none' ? activeMilestone : null;
    const task = await onCreateTask({
      title, date: null, repeat: 'none', type: 'normal', priority: 'none',
      projectId: project.id, milestoneId,
    });
    const col = columns.find(c => c.id === columnId);
    if (!col) return;
    if (col.role === 'done') onSetTaskDone(task.id, true);
    if (col.role !== 'todo') {
      const existing = cardsByCol.get(columnId) ?? [];
      const last = existing.length ? existing[existing.length - 1].order : 0;
      placeCard({ cardKey: taskCardKey(task.id), columnId, position: last + 1 });
    }
  };

  // ── Колонки ───────────────────────────────────────────────────
  const canAdd = columns.length < MAX_COLUMNS;
  const addColumn = () => saveColumns([...columns, { id: `custom_${Date.now()}`, name: 'Новая колонка', role: 'custom' } as Col]);
  const renameColumn = (id: string, name: string) => saveColumns(columns.map(c => c.id === id ? { ...c, name } : c));
  const setColumnColor = (id: string, color: string) => saveColumns(columns.map(c => c.id === id ? { ...c, color } : c));
  const deleteColumn = (id: string) => saveColumns(columns.filter(c => c.id !== id));

  // ── Открытие задачи / подзадачи ───────────────────────────────
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingSub, setViewingSub] = useState<{ taskId: string; item: SubtaskItem } | null>(null);
  const openTask = (card: BoardCard) => setEditingTask(card.task);
  const openSubtask = (card: BoardCard) => {
    if (card.kind === 'subtask') setViewingSub({ taskId: card.task.id, item: card.item });
  };

  return (
    <div className={styles.root}>
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
            <button type="button" className={boardStyles.addColumn} onClick={addColumn}>
              <Plus size={16} strokeWidth={2} /> Колонка
            </button>
          )}
        </div>

        <DragOverlay>
          {activeDrag?.type === 'card' && (
            <div className={boardStyles.card} style={{ width: 266, boxShadow: 'var(--shadow-pop)', cursor: 'grabbing' }}>
              <div className={boardStyles.cardInner}><CardFace card={activeDrag.card} /></div>
            </div>
          )}
          {activeDrag?.type === 'group' && (
            <div className={boardStyles.group} style={{ width: 266, boxShadow: 'var(--shadow-pop)', cursor: 'grabbing' }}>
              <GroupFace task={activeDrag.task} count={activeDrag.count} />
            </div>
          )}
          {activeDrag?.type === 'column' && (
            <div className={boardStyles.colOverlay}>{activeDrag.label}</div>
          )}
        </DragOverlay>
      </DndContext>

      {editingTask && (
        <TaskFormModal
          task={editingTask}
          date={new Date()}
          isAdmin={isAdmin}
          userTags={userTags}
          onSave={(data) => { onUpdateTask(editingTask.id, data); setEditingTask(null); }}
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
          onToggle={() => onSetSubtaskDone(viewingSub.taskId, viewingSub.item.id, !viewingSub.item.done)}
          onEdit={() => {
            const base = taskById.get(viewingSub.taskId);
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
