import { Task, TaskRepeat, TaskType, TaskPriority, RepeatConfig, SubtaskSection, ReminderRule } from './tasks';
import type { Tag } from './tags';

export interface TaskFormState {
  title: string;
  description: string;
  formDate: string;
  multiDay: boolean;
  endDate: string;
  time: string;
  endTime: string;
  repeat: TaskRepeat;
  hasEnd: boolean;
  repeatUntil: string;
  type: TaskType;
  priority: TaskPriority;
  repeatConfig: RepeatConfig | null;
  selectedTag?: Tag;
  sections: SubtaskSection[];
  reminders: ReminderRule[];
}

export function buildTaskPayload(state: TaskFormState): Omit<Task, 'id' | 'status'> {
  const {
    title, description, formDate, multiDay, endDate, time, endTime,
    repeat, hasEnd, repeatUntil, type, priority, repeatConfig, selectedTag, sections, reminders,
  } = state;

  const resolvedEndDate = multiDay && endDate && endDate > formDate ? endDate : undefined;

  return {
    title:       title.trim(),
    description: description.trim() || undefined,
    date:        formDate,
    endDate:     resolvedEndDate,
    time:        time || undefined,
    endTime:     (time && endTime && endTime > time) ? endTime : undefined,
    repeat,
    repeatUntil: (repeat !== 'none' && hasEnd && repeatUntil) ? repeatUntil : undefined,
    type,
    priority,
    repeatConfig: repeatConfig ?? undefined,
    icon:        selectedTag?.icon ?? null,
    tags:        selectedTag ? [selectedTag] : [],
    subtasks:    sections,
    reminders:   reminders.length ? reminders : null,
  };
}
