import { api } from './api';

export type TaskStatus = 'done' | 'missed' | 'pending';
export type TaskRepeat = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type TaskType   = 'normal' | 'mandatory' | 'event';

export interface Task {
  id: string;
  title: string;
  description?: string;
  time?: string;        // "HH:MM"
  status: TaskStatus;
  date: string;         // "YYYY-MM-DD"
  repeat: TaskRepeat;
  repeatUntil?: string; // "YYYY-MM-DD" — last date of repetition (inclusive)
  type: TaskType;
}

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Key format for per-date completion tracking
export function completionKey(taskId: string, dateStr: string) {
  return `${taskId}__${dateStr}`;
}

// Returns tasks visible on a given date (including repeating ones).
// Status is resolved per-date via the completions set.
export function getTasksForDate(
  allTasks: Task[],
  date: Date,
  completions: Set<string> = new Set(),
): Task[] {
  const dateStr = toDateStr(date);
  const result: Task[] = [];

  for (const task of allTasks) {
    let isMatch = false;

    if (task.date === dateStr) {
      isMatch = true;
    } else if (task.date < dateStr && task.repeat !== 'none') {
      if (task.repeatUntil && dateStr > task.repeatUntil) continue;

      const taskDate = new Date(task.date + 'T00:00:00');
      switch (task.repeat) {
        case 'daily':
          isMatch = true;
          break;
        case 'weekly':
          isMatch = taskDate.getDay() === date.getDay();
          break;
        case 'monthly':
          isMatch = taskDate.getDate() === date.getDate();
          break;
        case 'yearly':
          isMatch =
            taskDate.getDate() === date.getDate() &&
            taskDate.getMonth() === date.getMonth();
          break;
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

// Deterministic mock temperature (°C) by day
export function getMockTemp(date: Date): number {
  return Math.round(10 + Math.sin(date.getDate() * 0.9 + date.getMonth()) * 6);
}

// ── API ───────────────────────────────────────────────────────

interface ApiTask {
  id: string; userId: string; title: string; description: string | null;
  date: string; time: string | null; repeat: string;
  repeatUntil: string | null; type: string;
}

function fromApi(t: ApiTask): Task {
  return {
    id: t.id, title: t.title,
    description: t.description ?? undefined,
    time: t.time ?? undefined,
    date: t.date,
    repeat: t.repeat as TaskRepeat,
    repeatUntil: t.repeatUntil ?? undefined,
    type: t.type as TaskType,
    status: 'pending',
  };
}

type Payload = Omit<Task, 'id' | 'status'>;

export const tasksApi = {
  getAll: (): Promise<Task[]> =>
    api.get<ApiTask[]>('/tasks').then(r => r.data.map(fromApi)),

  getCompletions: (): Promise<string[]> =>
    api.get<string[]>('/tasks/completions').then(r => r.data),

  create: (p: Payload): Promise<Task> =>
    api.post<ApiTask>('/tasks', {
      title:       p.title,
      description: p.description ?? null,
      date:        p.date,
      time:        p.time ?? null,
      repeat:      p.repeat,
      repeatUntil: p.repeatUntil ?? null,
      type:        p.type,
    }).then(r => fromApi(r.data)),

  update: (id: string, p: Payload): Promise<Task> =>
    api.patch<ApiTask>(`/tasks/${id}`, {
      title:       p.title,
      description: p.description ?? null,
      date:        p.date,
      time:        p.time ?? null,
      repeat:      p.repeat,
      repeatUntil: p.repeatUntil ?? null,
      type:        p.type,
    }).then(r => fromApi(r.data)),

  delete: (id: string): Promise<void> =>
    api.delete(`/tasks/${id}`).then(() => undefined),

  toggleCompletion: (taskId: string, date: string): Promise<{ done: boolean }> =>
    api.post(`/tasks/${taskId}/complete/${date}`).then(r => r.data),
};
