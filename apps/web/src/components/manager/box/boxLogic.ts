import {
  Task,
  TaskType,
  TaskPriority,
  completionKey,
  isSeriesTask,
  getSeriesDays,
} from '../../../lib/tasks';

/** Производный статус задачи в «Коробке». Серии трактуем как ongoing → 'active'. */
export type BoxStatus = 'active' | 'done' | 'overdue';

export type BoxSortKey = 'date' | 'title' | 'priority';
export type BoxGroupBy = 'none' | 'tag' | 'type' | 'month';

export interface BoxFilters {
  search: string;
  tagIds: string[];
  noTags: boolean;
  types: TaskType[];
  priorities: TaskPriority[];
  statuses: BoxStatus[];
  dateFrom: string;       // YYYY-MM-DD | ''
  dateTo: string;         // YYYY-MM-DD | ''
  repeatOnly: boolean;    // только серии (повтор/многодневные)
}

export const EMPTY_FILTERS: BoxFilters = {
  search: '',
  tagIds: [],
  noTags: false,
  types: [],
  priorities: [],
  statuses: [],
  dateFrom: '',
  dateTo: '',
  repeatOnly: false,
};

export function hasActiveFilters(f: BoxFilters): boolean {
  return (
    f.search.trim() !== '' ||
    f.tagIds.length > 0 ||
    f.noTags ||
    f.types.length > 0 ||
    f.priorities.length > 0 ||
    f.statuses.length > 0 ||
    f.dateFrom !== '' ||
    f.dateTo !== '' ||
    f.repeatOnly
  );
}

const PRIORITY_WEIGHT: Record<TaskPriority, number> = { high: 3, medium: 2, low: 1, none: 0 };

/**
 * Дата «представителя» задачи для сортировки/показа: для серии — ближайшее
 * будущее вхождение (или последнее прошедшее), для одиночной — её дата.
 */
export function nextOccurrenceStr(task: Task, todayStr: string): string {
  if (isSeriesTask(task)) {
    const days = getSeriesDays(task, task.dayOverrides);
    const upcoming = days.find(d => d >= todayStr);
    return upcoming ?? days[days.length - 1] ?? task.date ?? '';
  }
  return task.date ?? '';
}

/** Статус задачи. Однозначен для одиночных; серии считаем активными. */
export function deriveBoxStatus(task: Task, completions: Set<string>, todayStr: string): BoxStatus {
  if (isSeriesTask(task)) return 'active';
  if (!task.date) return 'active';      // бэклог без даты — не просрочен
  const done = completions.has(completionKey(task.id, task.date));
  if (done) return 'done';
  return task.date < todayStr ? 'overdue' : 'active';
}

/** Кол-во просрочённых задач — для бейджа на «Коробке». */
export function countOverdue(tasks: Task[], completions: Set<string>, todayStr: string): number {
  let n = 0;
  for (const t of tasks) if (deriveBoxStatus(t, completions, todayStr) === 'overdue') n++;
  return n;
}

export function matchesFilters(
  task: Task,
  f: BoxFilters,
  completions: Set<string>,
  todayStr: string,
): boolean {
  // Текстовый поиск
  const q = f.search.trim().toLowerCase();
  if (q) {
    const hay = `${task.title} ${task.description ?? ''}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }

  // Теги
  const taskTagIds = (task.tags ?? []).map(t => t.id);
  if (f.noTags && taskTagIds.length > 0) return false;
  if (f.tagIds.length > 0 && !f.tagIds.some(id => taskTagIds.includes(id))) return false;

  // Тип / приоритет
  if (f.types.length > 0 && !f.types.includes(task.type)) return false;
  if (f.priorities.length > 0 && !f.priorities.includes(task.priority ?? 'none')) return false;

  // Статус
  if (f.statuses.length > 0 && !f.statuses.includes(deriveBoxStatus(task, completions, todayStr))) {
    return false;
  }

  // Только серии
  if (f.repeatOnly && !isSeriesTask(task)) return false;

  // Период (перекрытие диапазонов): бэклог без даты под фильтр периода не подходит
  if (f.dateFrom || f.dateTo) {
    if (!task.date) return false;
    const start = task.date;
    const end = task.endDate
      ?? (task.repeat !== 'none' ? (task.repeatUntil ?? '9999-12-31') : task.date);
    if (f.dateFrom && end < f.dateFrom) return false;
    if (f.dateTo && start > f.dateTo) return false;
  }

  return true;
}

export function sortTasks(tasks: Task[], key: BoxSortKey, todayStr: string): Task[] {
  const arr = [...tasks];
  if (key === 'title') {
    arr.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
  } else if (key === 'priority') {
    arr.sort((a, b) => {
      const d = PRIORITY_WEIGHT[b.priority ?? 'none'] - PRIORITY_WEIGHT[a.priority ?? 'none'];
      if (d !== 0) return d;
      return nextOccurrenceStr(a, todayStr).localeCompare(nextOccurrenceStr(b, todayStr));
    });
  } else {
    // date: ближайшие вхождения первыми
    arr.sort((a, b) => nextOccurrenceStr(a, todayStr).localeCompare(nextOccurrenceStr(b, todayStr)));
  }
  return arr;
}

export interface BoxGroup {
  key: string;
  label: string;
  tasks: Task[];
}

const TYPE_LABEL: Record<TaskType, string> = {
  normal: 'Обычные',
  mandatory: 'Обязательные',
  event: 'События',
};

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

export function groupTasks(tasks: Task[], by: BoxGroupBy, todayStr: string): BoxGroup[] {
  if (by === 'none') return [{ key: 'all', label: '', tasks }];

  const map = new Map<string, BoxGroup>();
  const push = (key: string, label: string, task: Task) => {
    const g = map.get(key);
    if (g) g.tasks.push(task);
    else map.set(key, { key, label, tasks: [task] });
  };

  for (const task of tasks) {
    if (by === 'type') {
      push(task.type, TYPE_LABEL[task.type], task);
    } else if (by === 'tag') {
      const tag = task.tags?.[0];
      if (tag) push(`tag:${tag.id}`, tag.name, task);
      else push('__none', 'Без тегов', task);
    } else {
      // month — по дате представителя
      const d = nextOccurrenceStr(task, todayStr);
      const [y, m] = d.split('-');
      push(`${y}-${m}`, `${MONTHS[Number(m) - 1]} ${y}`, task);
    }
  }

  const groups = [...map.values()];
  if (by === 'month') groups.sort((a, b) => a.key.localeCompare(b.key));
  else groups.sort((a, b) => a.label.localeCompare(b.label, 'ru'));
  return groups;
}
