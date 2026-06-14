import { api } from './api';
import { Task, ReminderRule, toDateStr, getTasksForDate } from './tasks';

/** Дефолтное время «вседневных» напоминаний (fallback, если профиль не загружен). */
export const DEFAULT_ALLDAY_TIME = '09:00';

/** Горизонт материализации инстансов (дней вперёд). */
export const HORIZON_DAYS = 60;

/** Инстанс напоминания для синхронизации с бэкендом. */
export interface SyncInstance {
  ruleId: string;
  occurrenceDate: string; // YYYY-MM-DD или '-' (для custom)
  linkDate: string;       // YYYY-MM-DD — для deep-link
  fireAt: string;         // ISO (UTC)
  title: string;
  occTime: string | null; // HH:MM вхождения (или null)
}

export interface ComputeOptions {
  /** «Сейчас» (для тестов и фильтра прошедших). По умолчанию — реальное время. */
  now?: Date;
  /** Время для задач без `time` (из профиля). По умолчанию DEFAULT_ALLDAY_TIME. */
  defaultAllDayTime?: string;
  /** Множество ключей выполнений `${taskId}__${date}` (для зависимостных повторов). */
  completions?: Set<string>;
  /** Горизонт в днях (по умолчанию HORIZON_DAYS). */
  horizonDays?: number;
}

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

/** Парсит локальное 'YYYY-MM-DDTHH:MM' / '...:SS' в Date (в часовом поясе клиента). */
function localToDate(local: string): Date {
  return new Date(local.length === 16 ? `${local}:00` : local);
}

interface Occurrence {
  day: string;            // YYYY-MM-DD
  time: string | null;    // эффективное время вхождения (HH:MM) или null
}

/**
 * Дни горизонта, в которые задача присутствует (по календарному расписанию), и
 * эффективное время начала каждого вхождения. Переиспользует движок повторов
 * (`getTasksForDate`), но нейтрализует погодные/праздничные условия — прогноза на
 * 60 дней вперёд нет, а напоминание привязано к плановому расписанию.
 */
export function enumerateOccurrences(
  task: Task,
  fromStr: string,
  toStr: string,
  completions: Set<string> = new Set(),
): Occurrence[] {
  // Снимаем погодные/праздничные фильтры (оставляем months/cyclic/interval/endAfter).
  const stripped: Task =
    task.repeatConfig
      ? {
          ...task,
          repeatConfig: {
            ...task.repeatConfig,
            weatherCondition: undefined,
            holidaySettings: undefined,
          },
        }
      : task;

  const out: Occurrence[] = [];
  // Начинаем не раньше даты задачи — до неё вхождений нет.
  let cur = task.date > fromStr ? task.date : fromStr;
  let guard = 0;
  while (cur <= toStr && guard++ < 800) {
    const matched = getTasksForDate([stripped], new Date(cur + 'T00:00:00'), completions);
    if (matched.length) {
      out.push({ day: cur, time: matched[0].time ?? null });
    }
    cur = addDaysStr(cur, 1);
  }
  return out;
}

/** Из одного правила → инстансы (с учётом вхождений). */
function ruleFireTimes(
  task: Task,
  rule: ReminderRule,
  occurrences: Occurrence[],
  defaultAllDayTime: string,
): { ruleId: string; occurrenceDate: string; linkDate: string; fireAt: Date; title: string; occTime: string | null }[] {
  if (rule.type === 'custom') {
    if (!rule.at) return [];
    const dateOnly = rule.at.slice(0, 10);
    const at = rule.at.includes('T') ? rule.at : `${rule.at}T${defaultAllDayTime}`;
    return [{
      ruleId: rule.id,
      occurrenceDate: '-',
      linkDate: dateOnly,
      fireAt: localToDate(at),
      title: task.title,
      occTime: null,
    }];
  }

  const offset = rule.offsetMinutes ?? 0;
  return occurrences.map(({ day, time }) => {
    const baseTime = time || defaultAllDayTime;
    const base = localToDate(`${day}T${baseTime}`);
    base.setMinutes(base.getMinutes() - offset);
    return {
      ruleId: rule.id,
      occurrenceDate: day,
      linkDate: day,
      fireAt: base,
      title: task.title,
      occTime: time,
    };
  });
}

/** Полный набор инстансов задачи на горизонт (отбрасывает прошедшие). */
export function computeTaskInstances(task: Task, opts: ComputeOptions = {}): SyncInstance[] {
  if (!task.reminders?.length) return [];

  const now = opts.now ?? new Date();
  const defaultAllDayTime = opts.defaultAllDayTime || DEFAULT_ALLDAY_TIME;
  const horizonDays = opts.horizonDays ?? HORIZON_DAYS;
  const fromStr = toDateStr(now);
  const toStr = addDaysStr(fromStr, horizonDays);

  // Вхождения нужны только относительным правилам; custom считается отдельно.
  const needsOccurrences = task.reminders.some(r => r.type !== 'custom');
  const occurrences = needsOccurrences
    ? enumerateOccurrences(task, fromStr, toStr, opts.completions)
    : [];

  const raw = task.reminders.flatMap(rule =>
    ruleFireTimes(task, rule, occurrences, defaultAllDayTime),
  );

  return raw
    .filter(i => i.fireAt.getTime() > now.getTime())
    .map(i => ({
      ruleId: i.ruleId,
      occurrenceDate: i.occurrenceDate,
      linkDate: i.linkDate,
      fireAt: i.fireAt.toISOString(),
      title: i.title,
      occTime: i.occTime,
    }));
}

/** Синхронизирует инстансы задачи с бэкендом (пустой массив очищает будущие). */
export async function syncTaskReminders(task: Task, opts: ComputeOptions = {}): Promise<void> {
  const instances = computeTaskInstances(task, opts);
  try {
    await api.put('/reminders/sync', { taskId: task.id, instances });
  } catch {
    /* не блокируем UX из-за сбоя синхронизации напоминаний */
  }
}
