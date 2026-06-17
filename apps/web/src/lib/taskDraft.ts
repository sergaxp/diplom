import { TaskRepeat, TaskType, TaskPriority, TaskDifficulty, SubtaskSection, ReminderRule } from './tasks';

export const DRAFT_TTL = 10 * 60 * 1000;

export interface Draft {
  title: string; description: string; time: string; endTime: string;
  repeat: TaskRepeat; hasEnd: boolean; repeatUntil: string;
  type: TaskType; priority: TaskPriority; difficulty: TaskDifficulty;
  deadline: boolean; tagId: string | null; multiDay: boolean; endDate: string;
  sections: SubtaskSection[];
  reminders: ReminderRule[];
  savedAt: number;
}

export function draftKey(dateStr: string) { return `wt_draft_${dateStr}`; }

export function isDraftExpired(savedAt: number, now: number, ttl: number = DRAFT_TTL): boolean {
  return now - savedAt > ttl;
}

export function loadDraft(dateStr: string): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(dateStr));
    if (!raw) return null;
    const d: Draft = JSON.parse(raw);
    if (isDraftExpired(d.savedAt, Date.now())) { localStorage.removeItem(draftKey(dateStr)); return null; }
    return d;
  } catch { return null; }
}

export function saveDraft(dateStr: string, d: Draft) {
  localStorage.setItem(draftKey(dateStr), JSON.stringify(d));
}

export function clearDraft(dateStr: string) {
  localStorage.removeItem(draftKey(dateStr));
}
