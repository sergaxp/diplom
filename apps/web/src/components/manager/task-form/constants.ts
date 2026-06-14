import { TaskRepeat, TaskType, TaskPriority } from '../../../lib/tasks';

export const MONTHS_GEN = [
  'января','февраля','марта','апреля','мая','июня',
  'июля','августа','сентября','октября','ноября','декабря',
];

// Полные названия дней недели (индекс — как у Date.getDay(): 0 = воскресенье).
export const WEEKDAYS_FULL = [
  'Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота',
];

export const REPEAT_LABELS: Record<TaskRepeat, string> = {
  none: 'Без повтора', daily: 'Каждый день', weekdays: 'Будни (Пн-Пт)',
  weekly: 'Каждую неделю', monthly: 'Каждый месяц', yearly: 'Каждый год',
  custom: 'Настраиваемый',
};

export const TYPE_LABELS: Record<TaskType, string> = {
  normal: 'Обычная', mandatory: 'Дедлайн', event: 'Эвент',
};

export const DEFAULT_TAG_COLOR = '#4F46E5';

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  none:   'Без приоритета',
  low:    'Средне важно',
  medium: 'Важно',
  high:   'Очень важно',
};

export const PRIORITY_COLORS: Record<TaskPriority, string | undefined> = {
  none: undefined, low: '#eab308', medium: '#3b82f6', high: '#ef4444',
};

export const TYPE_COLORS: Record<string, string | undefined> = {
  normal: undefined, mandatory: '#ef4444', event: '#8b5cf6',
};

export const ATTACH_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm,video/ogg,application/zip,application/x-7z-compressed,application/x-rar-compressed,application/pdf';
