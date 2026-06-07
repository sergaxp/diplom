import type { CSSProperties } from 'react';
import { Task, toDateStr, getTasksForDate, getMultiDayOccurrence } from './tasks';
import type { HolidayMap } from './holidays';

// ── Константы ──────────────────────────────────────────────────

export const WEEKDAYS    = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
export const DAY_SHORT   = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
export const MONTHS      = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                            'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
export const MONTHS_SHORT = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
export const MONTHS_GEN  = ['января','февраля','марта','апреля','мая','июня',
                            'июля','августа','сентября','октября','ноября','декабря'];
export const QUARTERS    = ['I кв.','II кв.','III кв.','IV кв.'];

export type ChartPeriod = 'day' | 'week' | 'month' | 'quarter' | 'year';
export const PERIOD_LABELS: Record<ChartPeriod, string> = {
  day: 'День', week: 'Нед', month: 'Мес', quarter: 'Кв', year: 'Год',
};

export type PickerType = 'month' | 'year';

export const HOURS         = Array.from({ length: 17 }, (_, i) => i + 7); // 7–23
export const HOUR_H        = 52;
export const TASK_H        = Math.max(Math.round(HOUR_H * 0.65), 30);      // ~34px
export const TASK_MINS     = Math.ceil((TASK_H / HOUR_H) * 60);             // ~40 мин – окно перекрытия
export const ALLDAY_TASK_H = 22;
export const ALLDAY_GAP    = 3;

export const SPAN_SLOT_H = 22; // px per task slot
export const SPAN_HEAD_H = 24; // px for day number header
export const SPAN_MAX_SLOTS = 3;

// Weekday-aligned year grid:
//   header: "Месяц | Пн Вт Ср Чт Пт Сб Вс Пн Вт …"  (37 day columns)
//   each month row places its days at columns offset by the weekday of the 1st
export const YR_COLS    = 37;            // 5 full weeks + 2 days – fits any month (max offset 6 + 31 days)
export const YR_SLOT_H  = 18;            // px per task slot
export const YR_HEAD_H  = 18;            // px for the day-number row
export const YR_MAX_SL  = 2;             // visible task slots per month before "+N"

// ── Базовые хелперы ────────────────────────────────────────────

export function pad(n: number) { return String(n).padStart(2, '0'); }

export function getISOWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y.getTime()) / 86_400_000 + 1) / 7);
}

/** Relative luminance of a #rrggbb color. Higher = lighter. */
export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  if (h.length !== 6) return 0.5;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Style for a task block – uses first tag color as full background */
export function taskColorStyle(t: Task): CSSProperties | undefined {
  const tag = t.tags?.[0];
  if (tag?.color) {
    const dark = luminance(tag.color) < 0.62;
    return {
      background: tag.color,
      color: dark ? '#fff' : '#1a1a1a',
      border: 'none',
    };
  }
  if (t.type === 'mandatory') {
    return { background: '#c2410c', color: '#fff', border: 'none' };
  }
  if (t.type === 'event') {
    return { background: '#1e3a8a', color: '#fff', border: 'none' };
  }
  return undefined;
}

/** Высота блока задачи в пикселях исходя из длительности */
export function taskBlockHeight(t: Task): number {
  if (!t.time) return ALLDAY_TASK_H;
  if (t.endTime) {
    const [sh, sm] = t.time.split(':').map(Number);
    const [eh, em] = t.endTime.split(':').map(Number);
    const dur = (eh * 60 + em) - (sh * 60 + sm);
    if (dur > 0) return Math.max(dur / 60 * HOUR_H, 24);
  }
  return TASK_H;
}

/** Активна ли повторяющаяся многодневная задача на dateStr */
export function isRepeatMultiDayActiveOn(t: Task, dateStr: string): boolean {
  if (t.repeatUntil && dateStr > t.repeatUntil) return false;
  const occ = getMultiDayOccurrence(t, dateStr);
  return occ != null && occ.startStr > t.date;
}

/** Активна ли задача на данной дате (учитывает endDate и repeat) */
export function taskActiveOn(t: Task, dateStr: string): boolean {
  if (t.endDate) {
    if (t.date <= dateStr && t.endDate >= dateStr) return true;
    if (t.repeat !== 'none' && t.date < dateStr) return isRepeatMultiDayActiveOn(t, dateStr);
    return false;
  }
  if (t.date === dateStr) return true;
  if (t.date < dateStr && t.repeat !== 'none') {
    if (t.repeatUntil && dateStr > t.repeatUntil) return false;
    const td = new Date(t.date + 'T00:00:00');
    const d  = new Date(dateStr + 'T00:00:00');
    switch (t.repeat) {
      case 'daily':   return true;
      case 'weekly':  return td.getDay() === d.getDay();
      case 'monthly': return td.getDate() === d.getDate();
      case 'yearly':  return td.getDate() === d.getDate() && td.getMonth() === d.getMonth();
    }
  }
  return false;
}

// ── Раскладка перекрывающихся задач по колонкам ───────────────
export function computeLayout(tasks: Task[]): Map<string, { col: number; totalCols: number }> {
  const map = new Map<string, { col: number; totalCols: number }>();

  const items = tasks
    .filter(t => t.time)
    .map(t => {
      const [h, m] = t.time!.split(':').map(Number);
      return { id: t.id, start: h * 60 + m, col: 0 };
    })
    .sort((a, b) => a.start - b.start);

  const endOf = (it: { start: number }) => it.start + TASK_MINS;

  // Проход 1: жадное назначение колонок
  for (let i = 0; i < items.length; i++) {
    const prev = items.slice(0, i).filter(j => endOf(j) > items[i].start);
    const used = new Set(prev.map(j => j.col));
    let col = 0;
    while (used.has(col)) col++;
    items[i].col = col;
    map.set(items[i].id, { col, totalCols: 1 });
  }

  // Проход 2: totalCols для кластеров (BFS связных компонент)
  const visited = new Uint8Array(items.length);
  for (let i = 0; i < items.length; i++) {
    if (visited[i]) continue;
    const cluster: number[] = [];
    const queue = [i];
    while (queue.length) {
      const cur = queue.pop()!;
      if (visited[cur]) continue;
      visited[cur] = 1;
      cluster.push(cur);
      for (let j = 0; j < items.length; j++) {
        if (!visited[j] && items[cur].start < endOf(items[j]) && items[j].start < endOf(items[cur]))
          queue.push(j);
      }
    }
    const totalCols = Math.max(...cluster.map(j => items[j].col)) + 1;
    cluster.forEach(j => { map.get(items[j].id)!.totalCols = totalCols; });
  }

  return map;
}

export function getWeekDays(date: Date): Date[] {
  const s = new Date(date); s.setHours(0,0,0,0);
  const off = s.getDay() === 0 ? 6 : s.getDay() - 1;
  s.setDate(s.getDate() - off);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(s); d.setDate(d.getDate() + i); return d; });
}

export function buildCells(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1);
  let dow = first.getDay() - 1; if (dow < 0) dow = 6;
  const dim = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < dow; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** Build full weeks for a month (including adjacent month days) */
export function buildWeeks(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  const dow = (first.getDay() + 6) % 7; // Mon=0
  const start = new Date(year, month, 1 - dow);
  const totalDays = new Date(year, month + 1, 0).getDate();
  const numWeeks = Math.ceil((dow + totalDays) / 7);
  return Array.from({ length: numWeeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      return date;
    })
  );
}

// ── Spanning bars (week / month / year views) ─────────────────

export interface SpanItem {
  task: Task;
  startCol: number;
  endCol: number;
  slot: number;
  continuesLeft: boolean;
  continuesRight: boolean;
}

export function computeWeekSpans(weekDays: Date[], allTasks: Task[], holidayMap?: HolidayMap): { spans: SpanItem[]; overflow: number[] } {
  // Get active tasks for each day
  const colTasks: Task[][] = weekDays.map(d => getTasksForDate(allTasks, d, new Set(), holidayMap));

  // Колонки, которые задача занимает на этой неделе (deleted-дни уже отфильтрованы
  // в getTasksForDate). Затем бьём их на непрерывные отрезки – удалённый день
  // внутри блока разрывает полосу (разрывов может быть несколько).
  const taskCols = new Map<string, { task: Task; cols: number[] }>();
  for (let ci = 0; ci < 7; ci++) {
    for (const t of colTasks[ci]) {
      const e = taskCols.get(t.id);
      if (!e) taskCols.set(t.id, { task: t, cols: [ci] });
      else e.cols.push(ci);
    }
  }

  const shiftStr = (base: Date, delta: number) => {
    const d = new Date(base); d.setDate(d.getDate() + delta); return toDateStr(d);
  };
  const dayBefore = shiftStr(weekDays[0], -1);
  const dayAfter  = shiftStr(weekDays[6], 1);
  const visibleOn = (t: Task, ds: string) => taskActiveOn(t, ds) && !t.dayOverrides?.[ds]?.deleted;

  // Разбиваем колонки на непрерывные отрезки
  const entries = Array.from(taskCols.values()).map(({ task, cols }) => {
    const sorted = [...cols].sort((a, b) => a - b);
    const runs: Array<[number, number]> = [];
    let s = sorted[0], p = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === p + 1) { p = sorted[i]; }
      else { runs.push([s, p]); s = sorted[i]; p = sorted[i]; }
    }
    runs.push([s, p]);
    return { task, cols: sorted, runs, min: sorted[0], max: sorted[sorted.length - 1] };
  });

  // Sort: longer spans first
  entries.sort((a, b) => (b.max - b.min) - (a.max - a.min) || a.min - b.min);

  // Assign slots (все отрезки одной задачи – на одном слоте/строке)
  const occupied = Array.from({ length: 50 }, () => Array(7).fill(false));
  const spans: SpanItem[] = [];

  for (const { task, cols, runs } of entries) {
    let slot = 0;
    outer: while (true) {
      for (const c of cols) { if (occupied[slot][c]) { slot++; continue outer; } }
      break;
    }
    for (const c of cols) occupied[slot][c] = true;
    for (const [rs, re] of runs) {
      spans.push({
        task, startCol: rs, endCol: re, slot,
        continuesLeft:  rs === 0 && visibleOn(task, dayBefore),
        continuesRight: re === 6 && visibleOn(task, dayAfter),
      });
    }
  }

  const overflow = Array(7).fill(0);
  for (const s of spans) {
    if (s.slot >= SPAN_MAX_SLOTS) for (let c = s.startCol; c <= s.endCol; c++) overflow[c]++;
  }

  return { spans: spans.filter(s => s.slot < SPAN_MAX_SLOTS), overflow };
}

export interface MonthSpanItem {
  task: Task;
  sd: number;
  ed: number;
  slot: number;
  cL: boolean;
  cR: boolean;
}

/** Раскладка полос задач по месячной сетке YearView – аналог computeWeekSpans */
export function computeMonthSpans(year: number, month: number, tasks: Task[], holidayMap?: HolidayMap): { spans: MonthSpanItem[]; overflow: number[] } {
  const dim = new Date(year, month + 1, 0).getDate();

  // Collect tasks active in this month
  const taskMap = new Map<string, { task: Task; days: number[] }>();
  for (let d = 1; d <= dim; d++) {
    const dt = new Date(year, month, d);
    for (const t of getTasksForDate(tasks, dt, new Set(), holidayMap)) {
      const e = taskMap.get(t.id);
      if (!e) taskMap.set(t.id, { task: t, days: [d] });
      else e.days.push(d);
    }
  }

  // Разбиваем дни задачи на непрерывные отрезки (удалённый день рвёт полосу)
  const mStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  const arr = Array.from(taskMap.values()).map(({ task, days }) => {
    const sorted = [...days].sort((a, b) => a - b);
    const runs: Array<[number, number]> = [];
    let s = sorted[0], p = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === p + 1) { p = sorted[i]; }
      else { runs.push([s, p]); s = sorted[i]; p = sorted[i]; }
    }
    runs.push([s, p]);
    return { task, days: sorted, runs };
  });
  // Sort: longer spans first
  arr.sort((a, b) => b.days.length - a.days.length || a.days[0] - b.days[0]);

  // Slot assignment (все отрезки задачи – на одном слоте)
  const occ = Array.from({ length: 20 }, () => Array(32).fill(false));
  const spans: MonthSpanItem[] = [];
  for (const { task, days, runs } of arr) {
    let slot = 0;
    outer: while (true) {
      for (const c of days) { if (occ[slot][c]) { slot++; continue outer; } }
      break;
    }
    for (const c of days) occ[slot][c] = true;
    for (const [rs, re] of runs) {
      spans.push({
        task, sd: rs, ed: re, slot,
        cL: rs === 1   && task.date < `${mStr}-01`,
        cR: re === dim && (task.endDate ?? task.date) > `${mStr}-${String(dim).padStart(2, '0')}`,
      });
    }
  }

  const vis  = spans.filter(s => s.slot < YR_MAX_SL);
  const ovfl = Array(32).fill(0);
  for (const s of spans) if (s.slot >= YR_MAX_SL) for (let c = s.sd; c <= s.ed; c++) ovfl[c]++;

  return { spans: vis, overflow: ovfl };
}
