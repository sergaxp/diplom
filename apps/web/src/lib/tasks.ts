import { api } from './api';
import type { Tag } from './tags';
import type { AchievementResult } from './achievements';

export type { Tag };

export type TaskStatus = 'done' | 'missed' | 'pending';
export type TaskRepeat = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type TaskType   = 'normal' | 'mandatory' | 'event';

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
  isGlobal?: boolean;
  icon?: string | null;
  tags?: Tag[];
}

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function completionKey(taskId: string, dateStr: string) {
  return `${taskId}__${dateStr}`;
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
      // Многодневная задача: видна на всех датах в диапазоне [date, endDate]
      isMatch = task.date <= dateStr && task.endDate >= dateStr;
    } else if (task.date === dateStr) {
      isMatch = true;
    } else if (task.date < dateStr && task.repeat !== 'none') {
      if (task.repeatUntil && dateStr > task.repeatUntil) continue;
      const taskDate = new Date(task.date + 'T00:00:00');
      switch (task.repeat) {
        case 'daily':   isMatch = true; break;
        case 'weekly':  isMatch = taskDate.getDay() === date.getDay(); break;
        case 'monthly': isMatch = taskDate.getDate() === date.getDate(); break;
        case 'yearly':  isMatch = taskDate.getDate() === date.getDate() && taskDate.getMonth() === date.getMonth(); break;
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
  repeat: string; repeatUntil: string | null; type: string; icon: string | null;
  tags?: Tag[];
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
    icon: t.icon ?? null,
    tags: t.tags ?? [],
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
      tagIds:      p.tags?.map(t => t.id) ?? [],
    }).then(r => ({ task: fromApi(r.data), newAchievements: r.data.newAchievements ?? [] })),

  update: (id: string, p: Payload): Promise<Task> =>
    api.patch<ApiTask>(`/tasks/${id}`, {
      title:       p.title,
      description: p.description ?? null,
      date:        p.date,
      time:        p.time        ?? null,
      endTime:     p.endTime     ?? null,
      endDate:     p.endDate     ?? null,
      repeat:      p.repeat,
      repeatUntil: p.repeatUntil ?? null,
      type:        p.type,
      tagIds:      p.tags?.map(t => t.id) ?? [],
    }).then(r => fromApi(r.data)),

  delete: (id: string): Promise<void> =>
    api.delete(`/tasks/${id}`).then(() => undefined),

  toggleCompletion: (taskId: string, date: string): Promise<{ done: boolean; newAchievements: AchievementResult[] }> =>
    api.post(`/tasks/${taskId}/complete/${date}`).then(r => r.data),
};
