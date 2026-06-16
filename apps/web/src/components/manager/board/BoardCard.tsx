'use client';

import { useSortable } from '@dnd-kit/sortable';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Task, TaskPriority } from '../../../lib/tasks';
import { BoardCard as TCard } from '../../../lib/board';
import { Icon, hasIcon } from '../../../lib/icons';
import styles from './BoardView.module.scss';

export type DragData =
  | { kind: 'card'; cardType: 'task' | 'subtask'; taskId: string; date: string; itemId?: string; label: string }
  | { kind: 'group'; taskId: string; date: string; columnId: string; itemIds: string[]; label: string }
  | { kind: 'column'; columnId: string; label: string };

function prioCls(p?: TaskPriority) {
  if (p === 'high')   return styles.prioHigh;
  if (p === 'medium') return styles.prioMedium;
  if (p === 'low')    return styles.prioLow;
  return '';
}

function Meta({ task }: { task: Task }) {
  const hasMeta = (task.priority && task.priority !== 'none') || task.time || (task.tags && task.tags.length);
  if (!hasMeta) return null;
  return (
    <div className={styles.cardMeta}>
      {task.priority && task.priority !== 'none' && <span className={[styles.prioDot, prioCls(task.priority)].join(' ')} />}
      {task.time && <span className={styles.cardTime}>{task.time}</span>}
      {task.tags?.slice(0, 3).map(tag => (
        <span key={tag.id} className={styles.cardTag} style={{ borderColor: tag.color }}>
          {hasIcon(tag.icon)
            ? <Icon name={tag.icon!} size={10} strokeWidth={2.5} />
            : <span className={styles.cardTagDot} style={{ background: tag.color }} />}
        </span>
      ))}
    </div>
  );
}

// Презентационное «лицо» карточки — используется и в sortable, и в DragOverlay.
export function CardFace({ card }: { card: TCard }) {
  return (
    <>
      {card.kind === 'subtask' && <span className={styles.parentTitle}>{card.task.title}</span>}
      <span className={styles.cardTitle}>
        {card.kind === 'task' && hasIcon(card.task.icon) && <Icon name={card.task.icon!} size={14} strokeWidth={1.75} />}
        {card.kind === 'task' ? card.task.title : card.item.title}
      </span>
      {card.kind === 'task' && <Meta task={card.task} />}
    </>
  );
}

export function GroupFace({ task, count }: { task: Task; count: number }) {
  return (
    <div className={styles.groupHead}>
      <span className={styles.groupTitle}>
        {hasIcon(task.icon) && <Icon name={task.icon!} size={14} strokeWidth={1.75} />}
        {task.title}
      </span>
      <span className={styles.groupCount}>{count}</span>
    </div>
  );
}

// ── Одиночная карточка (задача без подзадач или одинокая подзадача) ──
export function SortableCard({
  card, onOpen,
}: {
  card: TCard;
  onOpen: () => void;
}) {
  const data: DragData = card.kind === 'task'
    ? { kind: 'card', cardType: 'task', taskId: card.task.id, date: card.date, label: card.task.title }
    : { kind: 'card', cardType: 'subtask', taskId: card.task.id, date: card.date, itemId: card.item.id, label: card.item.title };
  const { setNodeRef, listeners, attributes, transform, transition, isDragging } = useSortable({ id: card.key, data });
  const style = { transform: CSS.Translate.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className={[styles.card, isDragging ? styles.placeholder : ''].join(' ')}
      {...listeners} {...attributes} onClick={onOpen} role="button" tabIndex={0}>
      <div className={styles.cardInner}><CardFace card={card} /></div>
    </div>
  );
}

// ── Группа: соседние подзадачи одной задачи ───────────────────
export function GroupUnit({
  task, cards, columnId, onOpenTask, onOpenSubtask,
}: {
  task: Task;
  cards: TCard[];
  columnId: string;
  onOpenTask: () => void;
  onOpenSubtask: (card: TCard) => void;
}) {
  const itemIds = cards.map(c => (c.kind === 'subtask' ? c.item.id : '')).filter(Boolean);
  const data: DragData = { kind: 'group', taskId: task.id, date: cards[0].date, columnId, itemIds, label: task.title };
  // Драг-узел — ТОЛЬКО заголовок (лист). Sortable-строки подзадач лежат рядом под
  // обычным контейнером, а не ВНУТРИ draggable-узла — вложенные dnd-узлы под
  // React 19 зацикливают измерения dnd-kit (Maximum update depth).
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: `group:${task.id}:${columnId}`, data });

  return (
    <div className={styles.group} style={{ opacity: isDragging ? 0.4 : undefined }}>
      <div ref={setNodeRef} className={styles.groupHead} {...listeners} {...attributes}
        onClick={onOpenTask} role="button" tabIndex={0}>
        <span className={styles.groupTitle}>
          {hasIcon(task.icon) && <Icon name={task.icon!} size={14} strokeWidth={1.75} />}
          {task.title}
        </span>
        <span className={styles.groupCount}>{cards.length}</span>
      </div>
      <div className={styles.groupBody}>
        {cards.map(c => (
          <GroupRow key={c.key} card={c} onOpen={() => onOpenSubtask(c)} />
        ))}
      </div>
    </div>
  );
}

function GroupRow({ card, onOpen }: { card: TCard; onOpen: () => void }) {
  const item = card.kind === 'subtask' ? card.item : null;
  const data: DragData = { kind: 'card', cardType: 'subtask', taskId: card.task.id, date: card.date, itemId: item?.id, label: item?.title ?? '' };
  const { setNodeRef, listeners, attributes, transform, transition, isDragging } = useSortable({ id: card.key, data });
  const style = { transform: CSS.Translate.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className={[styles.subRow, isDragging ? styles.placeholder : ''].join(' ')}
      {...listeners} {...attributes} onClick={onOpen} role="button" tabIndex={0}>
      <span className={styles.subTitle}>{item?.title}</span>
    </div>
  );
}
