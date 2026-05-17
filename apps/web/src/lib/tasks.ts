import { api } from './api';
import type { Tag } from './tags';
import type { AchievementResult } from './achievements';

export type { Tag };

export type TaskStatus   = 'done' | 'missed' | 'pending';
export type TaskRepeat   = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly' | 'custom';
export type TaskType     = 'normal' | 'mandatory' | 'event';
export type TaskPriority = 'none' | 'low' | 'medium' | 'high';

export interface RepeatConfig {
  every: number;
  unit: 'day' | 'week' | 'month' | 'year';
  weekdays?: number[];   // 0=Sun 1=Mon … 6=Sat
  skipWeekends?: boolean;
  endAfter?: number;
}

export interface SubtaskItem {
  id: string;
  title: string;
  done: boolean;
}

export interface SubtaskSection {
  id: string;
  title: string;
  items: SubtaskItem[];
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  time?: string;       // HH:MM — начало
  endTime?: string;    // HH:MM — конец (для многочасовых)
  endDate?: string;    // YYYY-MM-DD — конец (для многодневных)
  status: TaskStatus;
  date: string;        // YYYY-MM-DD — начало
  repeat: TaskRepeat;
  repeatUntil?: string;
  type: TaskType;
  priority?: TaskPriority;
  repeatConfig?: RepeatConfig | null;
  isGlobal?: boolean;
  icon?: string | null;
  tags?: Tag[];
  subtasks?: SubtaskSection[] | null;
}

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function completionKey(taskId: string, dateStr: string) {
  return `${taskId}__${dateStr}`;
}

// Проверяет, активна ли повторяющаяся многодневная задача на указанную дату
function isRepeatMultiDayActiveOn(task: Task, dateStr: string): boolean {
  if (!task.endDate || task.repeat === 'none') return false;
  if (task.repeatUntil && dateStr > task.repeatUntil) return false;

  const checkDate = new Date(dateStr    + 'T00:00:00');
  const origStart = new Date(task.date  + 'T00:00:00');
  const origEnd   = new Date(task.endDate + 'T00:00:00');

  if (checkDate < origStart) return false;

  const durationDays = Math.round((origEnd.getTime() - origStart.getTime()) / 86_400_000);

  if (task.repeat === 'daily') return true; // каждый день покрыт

  let occStart: Date;

  if (task.repeat === 'weekly') {
    const dayDiff = (checkDate.getDay() - origStart.getDay() + 7) % 7;
    occStart = new Date(checkDate);
    occStart.setDate(occStart.getDate() - dayDiff);
  } else if (task.repeat === 'monthly') {
    occStart = new Date(checkDate.getFullYear(), checkDate.getMonth(), origStart.getDate());
    if (occStart > checkDate) occStart.setMonth(occStart.getMonth() - 1);
  } else if (task.repeat === 'yearly') {
    occStart = new Date(checkDate.getFullYear(), origStart.getMonth(), origStart.getDate());
    if (occStart > checkDate) occStart.setFullYear(occStart.getFullYear() - 1);
  } else {
    return false;
  }

  if (occStart < origStart) return false;

  const occEnd = new Date(occStart);
  occEnd.setDate(occEnd.getDate() + durationDays);
  return checkDate <= occEnd;
}

function evaluateCustomRepeat(task: Task, date: Date, taskStart: Date): boolean {
  const cfg = task.repeatConfig;
  if (!cfg) return false;
  const diffMs = date.getTime() - taskStart.getTime();
  if (diffMs < 0) return false;
  const diffDays = Math.round(diffMs / 86_400_000);
  const dow = date.getDay();
  if (cfg.skipWeekends && (dow === 0 || dow === 6)) return false;
  if (cfg.weekdays && cfg.weekdays.length > 0 && !cfg.weekdays.includes(dow)) return false;
  const every = cfg.every ?? 1;
  switch (cfg.unit) {
    case 'day':   return diffDays % every === 0;
    case 'week':  return (Math.floor(diffDays / 7)) % every === 0 && (cfg.weekdays?.includes(dow) ?? taskStart.getDay() === dow);
    case 'month': {
      const m = (date.getFullYear() - taskStart.getFullYear()) * 12 + (date.getMonth() - taskStart.getMonth());
      return m % every === 0 && date.getDate() === taskStart.getDate();
    }
    case 'year': {
      const y = date.getFullYear() - taskStart.getFullYear();
      return y % every === 0 && date.getMonth() === taskStart.getMonth() && date.getDate() === taskStart.getDate();
    }
    default: return false;
  }
}

export function getTasksForDate(
  allTasks: Task[],
  date: Date,
  completions: Set<string> = new Set(),
): Task[] {
  const dateStr = toDateStr(date);
  const result: Task[] = [];

  for (const task of allTasks) {
    let isMatch = false;

    if (task.endDate) {
      // Первое вхождение диапазона
      if (task.date <= dateStr && task.endDate >= dateStr) {
        isMatch = true;
      } else if (task.repeat !== 'none' && task.date < dateStr) {
        // Повторяющееся многодневное событие
        isMatch = isRepeatMultiDayActiveOn(task, dateStr);
      }
    } else if (task.date === dateStr) {
      isMatch = true;
    } else if (task.date < dateStr && task.repeat !== 'none') {
      if (task.repeatUntil && dateStr > task.repeatUntil) continue;
      const taskDate = new Date(task.date + 'T00:00:00');
      switch (task.repeat) {
        case 'daily':    isMatch = true; break;
        case 'weekdays': isMatch = date.getDay() >= 1 && date.getDay() <= 5; break;
        case 'weekly':   isMatch = taskDate.getDay() === date.getDay(); break;
        case 'monthly':  isMatch = taskDate.getDate() === date.getDate(); break;
        case 'yearly':   isMatch = taskDate.getDate() === date.getDate() && taskDate.getMonth() === date.getMonth(); break;
        case 'custom':   isMatch = evaluateCustomRepeat(task, date, taskDate); break;
      }
    }

    if (isMatch) {
      const key = completionKey(task.id, dateStr);
      const status: TaskStatus = completions.has(key) ? 'done' : 'pending';
      result.push({ ...task, status });
    }
  }

  return result.sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'));
}

export function getMockTemp(date: Date): number {
  return Math.round(10 + Math.sin(date.getDate() * 0.9 + date.getMonth()) * 6);
}

// ── API ───────────────────────────────────────────────────────

interface ApiTask {
  id: string; userId: string; title: string; description: string | null;
  date: string; time: string | null; endTime: string | null; endDate: string | null;
  repeat: string; repeatUntil: string | null; type: string; priority: string;
  repeatConfig: object | null;
  icon: string | null;
  tags?: Tag[];
  subtasks?: object[] | null;
}

function fromApi(t: ApiTask): Task {
  return {
    id: t.id, title: t.title,
    description: t.description ?? undefined,
    time:    t.time    ?? undefined,
    endTime: t.endTime ?? undefined,
    endDate: t.endDate ?? undefined,
    date: t.date,
    repeat: t.repeat as TaskRepeat,
    repeatUntil: t.repeatUntil ?? undefined,
    type: t.type as TaskType,
    priority: (t.priority ?? 'none') as TaskPriority,
    repeatConfig: (t.repeatConfig ?? null) as RepeatConfig | null,
    icon: t.icon ?? null,
    tags: t.tags ?? [],
    subtasks: (t.subtasks ?? null) as SubtaskSection[] | null,
    status: 'pending',
  };
}

type Payload = Omit<Task, 'id' | 'status'>;

export const tasksApi = {
  getAll: (): Promise<Task[]> =>
    api.get<ApiTask[]>('/tasks').then(r => r.data.map(fromApi)),

  getGlobalEvents: (): Promise<Task[]> =>
    api.get<(ApiTask & { icon?: string | null })[]>('/tasks/events').then(r =>
      r.data.map(t => ({
        ...fromApi(t),
        isGlobal: true,
        status: 'pending' as TaskStatus,
        icon: t.icon ?? null,
      })),
    ),

  getCompletions: (): Promise<string[]> =>
    api.get<string[]>('/tasks/completions').then(r => r.data),

  create: (p: Payload): Promise<{ task: Task; newAchievements: AchievementResult[] }> =>
    api.post<ApiTask & { newAchievements?: AchievementResult[] }>('/tasks', {
      title:       p.title,
      description: p.description ?? null,
      date:        p.date,
      time:        p.time        ?? null,
      endTime:     p.endTime     ?? null,
      endDate:     p.endDate     ?? null,
      repeat:      p.repeat,
      repeatUntil: p.repeatUntil ?? null,
      type:        p.type,
      priority:     p.priority     ?? 'none',
      repeatConfig: p.repeatConfig ?? null,
      icon:         p.icon         ?? null,
      tagIds:       p.tags?.map(t => t.id) ?? [],
      subtasks:     p.subtasks     ?? null,
    }).then(r => ({ task: fromApi(r.data), newAchievements: r.data.newAchievements ?? [] })),

  update: (id: string, p: Payload): Promise<Task> =>
    api.patch<ApiTask>(`/tasks/${id}`, {
      title:        p.title,
      description:  p.description  ?? null,
      date:         p.date,
      time:         p.time         ?? null,
      endTime:      p.endTime      ?? null,
      endDate:      p.endDate      ?? null,
      repeat:       p.repeat,
      repeatUntil:  p.repeatUntil  ?? null,
      type:         p.type,
      priority:     p.priority     ?? 'none',
      repeatConfig: p.repeatConfig ?? null,
      icon:         p.icon         ?? null,
      tagIds:       p.tags?.map(t => t.id) ?? [],
      subtasks:     p.subtasks     ?? null,
    }).then(r => fromApi(r.data)),

  delete: (id: string): Promise<void> =>
    api.delete(`/tasks/${id}`).then(() => undefined),

  toggleCompletion: (taskId: string, date: string): Promise<{ done: boolean; newAchievements: AchievementResult[] }> =>
    api.post(`/tasks/${taskId}/complete/${date}`).then(r => r.data),
};
