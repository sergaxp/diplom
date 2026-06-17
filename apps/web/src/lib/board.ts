import { api } from './api';
import {
  Task, SubtaskItem,
  completionKey, isSeriesTask, expandSeriesSubtasks,
} from './tasks';

// ── Типы ──────────────────────────────────────────────────────
export type BoardColumnRole = 'todo' | 'doing' | 'done' | 'custom';

export interface BoardColumn {
  id: string;
  name: string;
  role: BoardColumnRole;
  /** Цвет колонки (hex). Если не задан — берётся по роли (см. columnColor). */
  color?: string;
}

export interface BoardPlacement {
  cardKey: string;
  date: string;
  columnId: string;
  position: number;
}

export const DEFAULT_COLUMNS: BoardColumn[] = [
  { id: 'todo',  name: 'Не начатые',   role: 'todo',  color: '#6B776F' },
  { id: 'doing', name: 'Начатые',      role: 'doing', color: '#3B82F6' },
  { id: 'done',  name: 'Завершённые',  role: 'done',  color: '#3E9C6D' },
];

export const MAX_COLUMNS = 5;

/** Палитра для выбора цвета колонки. */
export const COLUMN_COLORS = [
  '#6B776F', '#B84040', '#C8862F', '#3E9C6D',
  '#3B82F6', '#8B5CF6', '#0EA5A5', '#DB2777',
];

/** Цвет колонки с дефолтом по роли. */
export function columnColor(col: BoardColumn): string {
  if (col.color) return col.color;
  if (col.role === 'doing') return '#3B82F6';
  if (col.role === 'done')  return '#3E9C6D';
  return '#6B776F';
}

// ── API ───────────────────────────────────────────────────────
export const boardApi = {
  getState: (): Promise<{ columns: BoardColumn[]; placements: BoardPlacement[] }> =>
    api.get<{ columns: BoardColumn[]; placements: BoardPlacement[] }>('/board').then(r => r.data),

  setColumns: (columns: BoardColumn[]): Promise<{ columns: BoardColumn[] }> =>
    api.put<{ columns: BoardColumn[] }>('/board/columns', { columns }).then(r => r.data),

  setPlacement: (p: BoardPlacement): Promise<void> =>
    api.put('/board/placement', p).then(() => undefined),

  removePlacement: (cardKey: string, date: string): Promise<void> =>
    api.delete('/board/placement', { params: { cardKey, date } }).then(() => undefined),
};

// ── Ключи карточек ────────────────────────────────────────────
export const taskCardKey = (taskId: string) => `task:${taskId}`;
export const subCardKey  = (taskId: string, itemId: string) => `sub:${taskId}:${itemId}`;
export const placementKey = (cardKey: string, date: string) => `${cardKey}__${date}`;

/** Шаг натурального порядка между задачами — место под их подзадачи. */
const TASK_STRIDE = 1000;

// ── Подзадачи задачи на конкретный день ───────────────────────
/** Плоский список подзадач (kind 'subtask') c корректным `done` для даты. */
export function dayedSubtasks(task: Task, date: string): SubtaskItem[] {
  const sections = task.subtasks ?? [];
  const flat = isSeriesTask(task)
    ? expandSeriesSubtasks(sections, date, task.dayOverrides?.[date]?.doneIds)
    : sections;
  return flat.flatMap(s => s.items).filter(i => (i.kind ?? 'subtask') === 'subtask');
}

// ── Карточки доски ────────────────────────────────────────────
interface CardBase { key: string; date: string; task: Task; columnId: string; order: number; }
export type BoardCard =
  | (CardBase & { kind: 'task'; done: boolean })
  | (CardBase & { kind: 'subtask'; item: SubtaskItem });

export interface BoardTask { task: Task; date: string }

export function roleColumnId(columns: BoardColumn[], role: BoardColumnRole): string {
  return columns.find(c => c.role === role)?.id ?? role;
}

type PlacementInfo = { columnId: string; position: number };

/**
 * Карточки доски (плоско): задача без подзадач → одна карточка, задача с
 * подзадачами → по карточке на подзадачу. Колонка: выполнение → done,
 * иначе сохранённая позиция, иначе todo. Порядок — сохранённый или натуральный.
 */
export function buildBoardCards(
  boardTasks: BoardTask[],
  completions: Set<string>,
  placements: Map<string, PlacementInfo>,
  columns: BoardColumn[],
): BoardCard[] {
  const todoId = roleColumnId(columns, 'todo');
  const doneId = roleColumnId(columns, 'done');
  const valid = new Set(columns.map(c => c.id));
  const cards: BoardCard[] = [];

  // Выполнение — приоритетный признак: выполненная карточка всегда в done (даже
  // если сохранён placement в другой колонке — напр. отметили «выполнено» в списке
  // слева, а карточка лежала в «Начатых»). Позицию в done сохраняем, только если
  // placement уже указывает на done; иначе ставим в натуральном порядке. Не
  // выполненная — по сохранённому placement, иначе в todo. Возврат в «Начатые» при
  // снятии выполнения из списка обеспечивает явная запись placement (см. page.tsx).
  const resolve = (key: string, date: string, done: boolean, natural: number): { columnId: string; order: number } => {
    const pl = placements.get(placementKey(key, date));
    const placed = pl && valid.has(pl.columnId) ? pl : null;
    if (done) {
      if (placed && placed.columnId === doneId) return { columnId: doneId, order: placed.position };
      return { columnId: doneId, order: natural };
    }
    if (placed) return { columnId: placed.columnId, order: placed.position };
    return { columnId: todoId, order: natural };
  };

  boardTasks.forEach(({ task, date }, ti) => {
    const base = ti * TASK_STRIDE;
    const subs = dayedSubtasks(task, date);
    if (subs.length === 0) {
      const key = taskCardKey(task.id);
      const done = completions.has(completionKey(task.id, date));
      const { columnId, order } = resolve(key, date, done, base);
      cards.push({ kind: 'task', key, date, task, columnId, order, done });
    } else {
      subs.forEach((item, si) => {
        const key = subCardKey(task.id, item.id);
        const { columnId, order } = resolve(key, date, item.done, base + si);
        cards.push({ kind: 'subtask', key, date, task, item, columnId, order });
      });
    }
  });

  return cards;
}

// ── Группировка по соседству (рендер) ─────────────────────────
export interface RenderUnit {
  id: string;
  kind: 'task' | 'subtask' | 'group';
  task: Task;
  cards: BoardCard[];
}

/** Соседние карточки-подзадачи одной задачи (≥2) сворачиваются в группу. */
export function toUnits(cards: BoardCard[]): RenderUnit[] {
  const units: RenderUnit[] = [];
  let i = 0;
  while (i < cards.length) {
    const c = cards[i];
    if (c.kind === 'task') {
      units.push({ id: c.key, kind: 'task', task: c.task, cards: [c] });
      i++;
      continue;
    }
    let j = i + 1;
    while (j < cards.length && cards[j].kind === 'subtask' && cards[j].task.id === c.task.id) j++;
    const run = cards.slice(i, j);
    if (run.length >= 2) {
      units.push({ id: `group:${c.task.id}`, kind: 'group', task: c.task, cards: run });
    } else {
      units.push({ id: c.key, kind: 'subtask', task: c.task, cards: [c] });
    }
    i = j;
  }
  return units;
}
