import { api } from './api';
import type { Tag } from './tags';
import type { AchievementResult } from './achievements';

export type { Tag };

export type TaskStatus   = 'done' | 'missed' | 'pending';
export type TaskRepeat   = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly' | 'custom';
export type TaskType     = 'normal' | 'mandatory' | 'event';
export type TaskPriority = 'none' | 'low' | 'medium' | 'high';

export interface CyclicSegment {
  active: number;  // дней с задачами
  rest: number;    // дней без задач
}

export interface WeatherCondition {
  skipRain?: boolean;
  skipSnow?: boolean;
  skipStorm?: boolean;
  skipFog?: boolean;        // туман (45, 48)
  skipCloudy?: boolean;     // пасмурно (3)
  requireClear?: boolean;   // только ясно (0, 1)
  minTempDay?: number | null;
  maxTempDay?: number | null;
  minTempNight?: number | null;
  maxTempNight?: number | null;
}

export interface HolidaySettings {
  skipHolidays?: boolean;
  onlyOnHolidays?: boolean;
}

export interface RepeatConfig {
  every?: number;
  unit?: 'day' | 'week' | 'month' | 'year';
  weekdays?: number[];   // 0=Sun 1=Mon … 6=Sat
  skipWeekends?: boolean;
  endAfter?: number;
  cyclicPattern?: CyclicSegment[];
  dependencyDays?: number;             // «через N дней после выполнения»
  months?: number[];                   // 1..12 — сезонный фильтр
  conditionScope?: 'perDay' | 'whole'; // для многодневных: проверять каждый день или весь блок
  weatherCondition?: WeatherCondition;
  holidaySettings?: HolidaySettings;
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

/** Возвращает диапазон [start, end] вхождения многодневной задачи, в котором лежит dateStr, или null */
export function getMultiDayOccurrence(task: Task, dateStr: string): { startStr: string; endStr: string } | null {
  if (!task.endDate || task.repeat === 'none') return null;

  const checkDate = new Date(dateStr    + 'T00:00:00');
  const origStart = new Date(task.date  + 'T00:00:00');
  const origEnd   = new Date(task.endDate + 'T00:00:00');

  if (checkDate < origStart) return null;

  // Первое (оригинальное) вхождение
  if (checkDate >= origStart && checkDate <= origEnd) {
    return { startStr: task.date, endStr: task.endDate };
  }

  const durationDays = Math.round((origEnd.getTime() - origStart.getTime()) / 86_400_000);

  // Для daily: каждое вхождение — пересекается со следующим (длится >= duration+1 дней),
  // фактически любой день после origStart покрыт. Считаем что occStart = checkDate (одно сплошное).
  if (task.repeat === 'daily') {
    return { startStr: dateStr, endStr: dateStr };
  }

  let occStart: Date | null = null;

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
  } else if (task.repeat === 'custom' && task.repeatConfig) {
    const cfg = task.repeatConfig;
    // Циклический/dependency не поддерживаются для multiDay (заблокированы в UI)
    if (cfg.cyclicPattern?.length || cfg.dependencyDays != null) return null;
    // weekdays для multiDay тоже не поддерживаются
    if (cfg.weekdays?.length) return null;

    const every = cfg.every ?? 1;
    const diffMs = checkDate.getTime() - origStart.getTime();
    const diffDays = Math.round(diffMs / 86_400_000);

    if (cfg.unit === 'day') {
      const k = Math.floor(diffDays / every);
      occStart = new Date(origStart);
      occStart.setDate(occStart.getDate() + k * every);
    } else if (cfg.unit === 'week') {
      const weeks = Math.floor(diffDays / 7);
      const k = Math.floor(weeks / every);
      occStart = new Date(origStart);
      occStart.setDate(occStart.getDate() + k * every * 7);
    } else if (cfg.unit === 'month') {
      const monthDiff = (checkDate.getFullYear() - origStart.getFullYear()) * 12
                      + (checkDate.getMonth() - origStart.getMonth());
      const k = Math.floor(monthDiff / every);
      occStart = new Date(origStart);
      occStart.setMonth(occStart.getMonth() + k * every);
    } else if (cfg.unit === 'year') {
      const yearDiff = checkDate.getFullYear() - origStart.getFullYear();
      const k = Math.floor(yearDiff / every);
      occStart = new Date(origStart);
      occStart.setFullYear(occStart.getFullYear() + k * every);
    } else {
      return null;
    }
  } else {
    return null;
  }

  if (!occStart || occStart < origStart) return null;

  const occEnd = new Date(occStart);
  occEnd.setDate(occEnd.getDate() + durationDays);

  // Конфликт #3: если вхождение оканчивается после repeatUntil — целиком пропускаем
  if (task.repeatUntil) {
    const occEndStr = toDateStr(occEnd);
    if (occEndStr > task.repeatUntil) return null;
  }

  if (checkDate > occEnd) return null;

  return { startStr: toDateStr(occStart), endStr: toDateStr(occEnd) };
}

function isRepeatMultiDayActiveOn(task: Task, dateStr: string): boolean {
  if (task.repeatUntil && dateStr > task.repeatUntil) return false;
  const occ = getMultiDayOccurrence(task, dateStr);
  if (!occ) return false;
  // Исключаем оригинальное вхождение — его обрабатывает caller отдельно
  return occ.startStr > task.date;
}

function evaluateCyclicPattern(pattern: CyclicSegment[], diffDays: number): boolean {
  const totalLen = pattern.reduce((s, p) => s + p.active + p.rest, 0);
  if (totalLen === 0) return false;
  const pos = diffDays % totalLen;
  let cursor = 0;
  for (const seg of pattern) {
    if (pos < cursor + seg.active) return true;
    cursor += seg.active;
    if (pos < cursor + seg.rest) return false;
    cursor += seg.rest;
  }
  return false;
}

export function checkWeatherCondition(
  entry: { tempMax: number; tempMin: number; weatherCode?: number } | undefined | null,
  cond: WeatherCondition,
): boolean {
  if (!entry) return true;
  const code = entry.weatherCode ?? 0;
  const isClear  = code === 0 || code === 1;
  const isCloudy = code === 3;
  const isFog    = code === 45 || code === 48;
  const isRain   = (code >= 51 && code <= 67) || (code >= 80 && code <= 82);
  const isSnow   = (code >= 71 && code <= 77) || (code >= 85 && code <= 86);
  const isStorm  = code >= 95;
  if (cond.skipRain     && (isRain || isStorm)) return false;
  if (cond.skipSnow     && isSnow)              return false;
  if (cond.skipStorm    && isStorm)             return false;
  if (cond.skipFog      && isFog)               return false;
  if (cond.skipCloudy   && isCloudy)            return false;
  if (cond.requireClear && !isClear)            return false;
  if (cond.minTempDay   != null && entry.tempMax < cond.minTempDay)   return false;
  if (cond.maxTempDay   != null && entry.tempMax > cond.maxTempDay)   return false;
  if (cond.minTempNight != null && entry.tempMin < cond.minTempNight) return false;
  if (cond.maxTempNight != null && entry.tempMin > cond.maxTempNight) return false;
  return true;
}

export function checkHolidayCondition(
  dateStr: string,
  holidayMap: Map<string, { type: string }> | null | undefined,
  settings: HolidaySettings,
): boolean {
  if (!holidayMap) return true;
  const entry = holidayMap.get(dateStr);
  const isHoliday = entry?.type === 'holiday';
  if (settings.onlyOnHolidays) return isHoliday;
  if (settings.skipHolidays && isHoliday) return false;
  return true;
}

function evaluateDependencyRepeat(
  taskId: string,
  date: Date,
  dateStr: string,
  taskStart: Date,
  completions: Set<string>,
  daysAfter: number,
): boolean {
  if (date < taskStart) return false;
  let latestBefore: string | null = null;
  const prefix = `${taskId}__`;
  for (const key of completions) {
    if (key.startsWith(prefix)) {
      const cDate = key.slice(prefix.length);
      if (cDate < dateStr && (!latestBefore || cDate > latestBefore)) latestBefore = cDate;
    }
  }
  if (latestBefore) {
    const cd = new Date(latestBefore + 'T00:00:00');
    cd.setDate(cd.getDate() + Math.max(1, daysAfter));
    return date >= cd;
  }
  return true;
}

function evaluateCustomRepeat(
  task: Task,
  date: Date,
  taskStart: Date,
  completions: Set<string>,
  dateStr: string,
): boolean {
  const cfg = task.repeatConfig;
  if (!cfg) return false;

  if (cfg.dependencyDays != null) {
    return evaluateDependencyRepeat(task.id, date, dateStr, taskStart, completions, cfg.dependencyDays);
  }

  const diffMs = date.getTime() - taskStart.getTime();
  if (diffMs < 0) return false;
  const diffDays = Math.round(diffMs / 86_400_000);

  if (cfg.cyclicPattern && cfg.cyclicPattern.length > 0) {
    return evaluateCyclicPattern(cfg.cyclicPattern, diffDays);
  }

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

/**
 * Возвращает 1-based порядковый номер вхождения задачи на указанную дату
 * (1 = первое вхождение). 0 — если дата раньше начала или вне расписания.
 * Используется для проверки `endAfter` (макс. число повторений).
 */
function getOccurrenceIndex(
  task: Task,
  date: Date,
  dateStr: string,
  taskStart: Date,
  completions: Set<string>,
): number {
  const diffMs = date.getTime() - taskStart.getTime();
  if (diffMs < 0) return 0;
  const diffDays = Math.round(diffMs / 86_400_000);
  const cfg = task.repeatConfig;

  switch (task.repeat) {
    case 'none': return diffDays === 0 ? 1 : 0;
    case 'daily': return diffDays + 1;
    case 'weekdays': {
      let count = 0;
      const d = new Date(taskStart);
      for (let i = 0; i <= diffDays; i++) {
        const dow = d.getDay();
        if (dow >= 1 && dow <= 5) count++;
        d.setDate(d.getDate() + 1);
      }
      return count;
    }
    case 'weekly':  return Math.floor(diffDays / 7) + 1;
    case 'monthly': return (date.getFullYear() - taskStart.getFullYear()) * 12
                         + (date.getMonth() - taskStart.getMonth()) + 1;
    case 'yearly':  return date.getFullYear() - taskStart.getFullYear() + 1;
    case 'custom': {
      if (!cfg) return 0;

      // Зависимый режим: индекс = число выполнений до этой даты + (этот день не выполнение ? 1 : 0)
      if (cfg.dependencyDays != null) {
        let count = 0;
        const prefix = `${task.id}__`;
        for (const key of completions) {
          if (key.startsWith(prefix)) {
            const cDate = key.slice(prefix.length);
            if (cDate < dateStr) count++;
          }
        }
        return count + 1;
      }

      // Цикличный: индекс = число активных дней от старта до этой даты
      if (cfg.cyclicPattern?.length) {
        const cycleLen = cfg.cyclicPattern.reduce((s, p) => s + p.active + p.rest, 0);
        if (cycleLen === 0) return 0;
        const activePerCycle = cfg.cyclicPattern.reduce((s, p) => s + p.active, 0);
        const completedCycles = Math.floor(diffDays / cycleLen);
        const remainder = diffDays % cycleLen;
        let activeInRemainder = 0;
        let cursor = 0;
        for (const seg of cfg.cyclicPattern) {
          if (remainder < cursor + seg.active) {
            activeInRemainder += remainder - cursor + 1;
            break;
          }
          activeInRemainder += seg.active;
          cursor += seg.active;
          if (remainder < cursor + seg.rest) break;
          cursor += seg.rest;
        }
        return completedCycles * activePerCycle + activeInRemainder;
      }

      // Интервальный
      const every = cfg.every ?? 1;
      switch (cfg.unit) {
        case 'day':   return Math.floor(diffDays / every) + 1;
        case 'week':  return Math.floor(diffDays / (7 * every)) + 1;
        case 'month': {
          const m = (date.getFullYear() - taskStart.getFullYear()) * 12
                  + (date.getMonth() - taskStart.getMonth());
          return Math.floor(m / every) + 1;
        }
        case 'year':  return Math.floor((date.getFullYear() - taskStart.getFullYear()) / every) + 1;
        default: return 0;
      }
    }
  }
  return 0;
}

type HolidayMapLike = Map<string, { type: string }>;
type WeatherMapLike = Map<string, { tempMax: number; tempMin: number; weatherCode?: number }>;

/** Проверяет условия (праздники/погода/сезон) для всего диапазона дат [start..end] */
function checkConditionsForRange(
  startStr: string,
  endStr: string,
  cfg: RepeatConfig,
  holidayMap?: HolidayMapLike | null,
  weatherMap?: WeatherMapLike | null,
): boolean {
  const d = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  while (d <= end) {
    const ds = toDateStr(d);
    if (cfg.months && cfg.months.length > 0 && !cfg.months.includes(d.getMonth() + 1)) return false;
    if (cfg.holidaySettings && (cfg.holidaySettings.skipHolidays || cfg.holidaySettings.onlyOnHolidays)) {
      if (!checkHolidayCondition(ds, holidayMap, cfg.holidaySettings)) return false;
    }
    if (cfg.weatherCondition) {
      if (!checkWeatherCondition(weatherMap?.get(ds), cfg.weatherCondition)) return false;
    }
    d.setDate(d.getDate() + 1);
  }
  return true;
}

export function getTasksForDate(
  allTasks: Task[],
  date: Date,
  completions: Set<string> = new Set(),
  holidayMap?: HolidayMapLike | null,
  weatherMap?: WeatherMapLike | null,
): Task[] {
  const dateStr = toDateStr(date);
  const result: Task[] = [];

  for (const task of allTasks) {
    let isMatch = false;

    if (task.endDate) {
      if (task.date <= dateStr && task.endDate >= dateStr) {
        isMatch = true;
      } else if (task.repeat !== 'none' && task.date < dateStr) {
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
        case 'custom':   isMatch = evaluateCustomRepeat(task, date, taskDate, completions, dateStr); break;
      }
    }

    if (isMatch) {
      const cfg = task.repeatConfig;
      const taskDate = new Date(task.date + 'T00:00:00');

      // ── Conflict #1: enforcement endAfter ─────────────────────
      if (cfg?.endAfter) {
        const idx = getOccurrenceIndex(task, date, dateStr, taskDate, completions);
        if (idx > cfg.endAfter) isMatch = false;
      }

      // ── Conflict #4: scope условий — perDay или весь блок ─────
      const wholeScope = cfg?.conditionScope === 'whole' && !!task.endDate;
      let scopeStartStr = dateStr;
      let scopeEndStr   = dateStr;
      if (isMatch && wholeScope) {
        const occ = getMultiDayOccurrence(task, dateStr);
        if (occ) { scopeStartStr = occ.startStr; scopeEndStr = occ.endStr; }
      }

      if (isMatch && cfg?.months && cfg.months.length > 0) {
        if (wholeScope) {
          // месяцы для whole-блока — пройдёт только если все дни в нужных месяцах
          const d = new Date(scopeStartStr + 'T00:00:00');
          const end = new Date(scopeEndStr + 'T00:00:00');
          while (d <= end) {
            if (!cfg.months.includes(d.getMonth() + 1)) { isMatch = false; break; }
            d.setDate(d.getDate() + 1);
          }
        } else if (!cfg.months.includes(date.getMonth() + 1)) {
          isMatch = false;
        }
      }

      if (isMatch && cfg && (cfg.holidaySettings || cfg.weatherCondition)) {
        if (wholeScope) {
          isMatch = checkConditionsForRange(scopeStartStr, scopeEndStr, cfg, holidayMap, weatherMap);
        } else {
          if (cfg.holidaySettings && (cfg.holidaySettings.skipHolidays || cfg.holidaySettings.onlyOnHolidays)) {
            isMatch = checkHolidayCondition(dateStr, holidayMap, cfg.holidaySettings);
          }
          if (isMatch && cfg.weatherCondition) {
            isMatch = checkWeatherCondition(weatherMap?.get(dateStr), cfg.weatherCondition);
          }
        }
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
