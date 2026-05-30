'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Task, toDateStr, getTasksForDate, getMultiDayOccurrence } from '../../lib/tasks';
import { useWeatherShownLock } from '../../lib/weatherLock';
import { useHolidays, HolidayMap, getHolidayColor, getHolidayName } from '../../lib/holidays';

type LucideIcon = React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
const Icons = LucideIcons as unknown as Record<string, LucideIcon>;
import { useCalendarWeather } from '../../lib/weather';
import { useAuthStore } from '../../store/authStore';
import styles from './Calendar.module.scss';

const WEEKDAYS    = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const DAY_SHORT   = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const MONTHS      = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                     'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const MONTHS_SHORT = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
const MONTHS_GEN  = ['января','февраля','марта','апреля','мая','июня',
                     'июля','августа','сентября','октября','ноября','декабря'];
const QUARTERS    = ['I кв.','II кв.','III кв.','IV кв.'];

type ChartPeriod = 'day' | 'week' | 'month' | 'quarter' | 'year';
const PERIOD_LABELS: Record<ChartPeriod, string> = {
  day: 'День', week: 'Нед', month: 'Мес', quarter: 'Кв', year: 'Год',
};

const HOURS         = Array.from({ length: 17 }, (_, i) => i + 7); // 7–23
const HOUR_H        = 52;
const TASK_H        = Math.max(Math.round(HOUR_H * 0.65), 30);      // ~34px
const TASK_MINS     = Math.ceil((TASK_H / HOUR_H) * 60);             // ~40 мин – окно перекрытия
const ALLDAY_TASK_H = 22;
const ALLDAY_GAP    = 3;

function pad(n: number) { return String(n).padStart(2, '0'); }

function getISOWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y.getTime()) / 86_400_000 + 1) / 7);
}

/** Relative luminance of a #rrggbb color. Higher = lighter. */
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  if (h.length !== 6) return 0.5;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Style for a task block – uses first tag color as full background */
function taskColorStyle(t: Task): React.CSSProperties | undefined {
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

// ── Вспомогательные функции ───────────────────────────────────

/** Высота блока задачи в пикселях исходя из длительности */
function taskBlockHeight(t: Task): number {
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
function isRepeatMultiDayActiveOn(t: Task, dateStr: string): boolean {
  if (t.repeatUntil && dateStr > t.repeatUntil) return false;
  const occ = getMultiDayOccurrence(t, dateStr);
  return occ != null && occ.startStr > t.date;
}

/** Активна ли задача на данной дате (учитывает endDate и repeat) */
function taskActiveOn(t: Task, dateStr: string): boolean {
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
function computeLayout(tasks: Task[]): Map<string, { col: number; totalCols: number }> {
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

function getWeekDays(date: Date): Date[] {
  const s = new Date(date); s.setHours(0,0,0,0);
  const off = s.getDay() === 0 ? 6 : s.getDay() - 1;
  s.setDate(s.getDate() - off);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(s); d.setDate(d.getDate() + i); return d; });
}

function buildCells(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1);
  let dow = first.getDay() - 1; if (dow < 0) dow = 6;
  const dim = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < dow; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// ── Floating picker (month or year) ──────────────────────────
type PickerType = 'month' | 'year';

interface PickerPanelProps {
  type: PickerType;
  currentMonth: number;
  currentYear: number;
  onPick: (month: number, year: number) => void;
  onClose: () => void;
}

function PickerPanel({ type, currentMonth, currentYear, onPick, onClose }: PickerPanelProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', click);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', click);
      document.removeEventListener('keydown', esc);
    };
  }, [onClose]);

  if (type === 'month') {
    return (
      <div ref={ref} className={styles.picker}>
        <div className={styles.pickerTitle}>Выбор месяца</div>
        <div className={styles.pickerGrid}>
          {MONTHS.map((_m, i) => (
            <button
              key={i}
              className={[styles.pickerCell, i === currentMonth ? styles.pickerCellActive : ''].join(' ')}
              onClick={() => { onPick(i, currentYear); onClose(); }}
            >
              {MONTHS_SHORT[i]}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const [pageStart, setPageStart] = useState(currentYear - 6);
  const years = Array.from({ length: 16 }, (_, i) => pageStart + i);

  return (
    <div ref={ref} className={styles.picker}>
      <div className={styles.pickerTitle}>
        <button className={styles.pickerNav} onClick={() => setPageStart(s => s - 16)}>‹</button>
        Выбор года
        <button className={styles.pickerNav} onClick={() => setPageStart(s => s + 16)}>›</button>
      </div>
      <div className={styles.pickerGrid}>
        {years.map(y => (
          <button
            key={y}
            className={[styles.pickerCell, y === currentYear ? styles.pickerCellActive : ''].join(' ')}
            onClick={() => { onPick(currentMonth, y); onClose(); }}
          >
            {y}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Mini month (month/quarter/year chart views) ───────────────
interface MiniMonthProps {
  year: number; month: number;
  tasks: Task[]; selectedDate: Date; onSelect: (d: Date) => void;
  compact?: boolean;
  holidayMap?: HolidayMap;
}

function MiniMonth({ year, month, tasks, selectedDate, onSelect, compact, holidayMap }: MiniMonthProps) {
  const today  = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const cells  = buildCells(year, month);
  const todStr = toDateStr(today);
  const selStr = toDateStr(selectedDate);

  return (
    <div className={[styles.miniMonth, compact ? styles.miniMonthCompact : ''].join(' ')}>
      <div className={styles.miniMonthHead}>
        {compact ? MONTHS_SHORT[month] : MONTHS[month]}
        {compact && <span className={styles.miniMonthYear}> {year}</span>}
      </div>
      <div className={styles.miniGrid}>
        {WEEKDAYS.map(d => <span key={d} className={styles.miniWeekday}>{compact ? d[0] : d}</span>)}
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const d = new Date(year, month, day);
          const ds = toDateStr(d);
          const n  = getTasksForDate(tasks, d, new Set(), holidayMap).length;
          const hol = holidayMap?.get(ds);
          const miniDow = d.getDay();
          const miniIsWeekend = miniDow === 0 || miniDow === 6;
          const miniIsWorkday = hol?.type === 'workday';
          const miniNumColor  = hol && hol.type !== 'workday' ? getHolidayColor(hol.type)
                              : miniIsWeekend && !miniIsWorkday ? '#ef4444'
                              : undefined;
          return (
            <button key={i}
              className={[styles.miniCell,
                ds === todStr ? styles.miniCellToday    : '',
                ds === selStr ? styles.miniCellSelected : '',
                n > 0         ? styles.miniCellHasTasks : '',
              ].join(' ')}
              onClick={() => onSelect(d)}
              title={hol ? hol.name || 'Праздник' : (n > 0 ? `${n} задач` : undefined)}
            >
              <span style={miniNumColor ? { color: miniNumColor } : undefined}>
                {day}
              </span>
              {n > 0 && !compact && <span className={styles.miniDot} />}
              {hol && !compact && (
                <span className={styles.miniHolDot} style={{ background: getHolidayColor(hol.type) }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Spanning month / quarter / year helpers ───────────────────

/** Build full weeks for a month (including adjacent month days) */
function buildWeeks(year: number, month: number): Date[][] {
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

const SPAN_SLOT_H = 22; // px per task slot
const SPAN_HEAD_H = 24; // px for day number header
const SPAN_MAX_SLOTS = 3;

interface SpanItem {
  task: Task;
  startCol: number;
  endCol: number;
  slot: number;
  continuesLeft: boolean;
  continuesRight: boolean;
}

function computeWeekSpans(weekDays: Date[], allTasks: Task[], holidayMap?: HolidayMap): { spans: SpanItem[]; overflow: number[] } {
  // Get active tasks for each day
  const colTasks: Task[][] = weekDays.map(d => getTasksForDate(allTasks, d, new Set(), holidayMap));

  // Колонки, которые задача занимает на этой неделе (deleted-дни уже отфильтрованы
  // в getTasksForDate). Затем бьём их на непрерывные отрезки — удалённый день
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

  // Assign slots (все отрезки одной задачи — на одном слоте/строке)
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

// ── Chart view ────────────────────────────────────────────────
const TYPE_CLS: Record<string, string> = {
  mandatory: styles.chartTaskMandatory,
  event:     styles.chartTaskEvent,
  normal:    styles.chartTaskNormal,
};

// ── TimeGridView – shared by 'day' and 'week' ────────────────
interface TimeGridProps {
  days: Date[];
  tasks: Task[];
  selectedDate: Date;
  onSelect: (d: Date) => void;
  holidayMap?: HolidayMap;
  showWeekNum?: boolean;
}

function TimeGridView({ days, tasks, selectedDate, onSelect, holidayMap, showWeekNum }: TimeGridProps) {
  const today  = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const todStr = toDateStr(today);
  const selStr = toDateStr(selectedDate);
  const now    = new Date();
  const nowTop = ((now.getHours() + now.getMinutes()/60) - 7) * HOUR_H;
  const showNow = now.getHours() >= 7 && now.getHours() < 23;

  // Compute global all-day slot map so multi-day tasks share a vertical row across columns
  const allDayPerDay = days.map(d => getTasksForDate(tasks, d, new Set(), holidayMap).filter(t => !t.time));
  const adRange = new Map<string, { task: Task; min: number; max: number }>();
  for (let ci = 0; ci < days.length; ci++) {
    for (const t of allDayPerDay[ci]) {
      const r = adRange.get(t.id);
      if (!r) adRange.set(t.id, { task: t, min: ci, max: ci });
      else { r.min = Math.min(r.min, ci); r.max = Math.max(r.max, ci); }
    }
  }
  const adSorted = Array.from(adRange.values()).sort((a, b) => (b.max - b.min) - (a.max - a.min) || a.min - b.min);
  const adOccupied: boolean[][] = Array.from({ length: 50 }, () => Array(days.length).fill(false));
  const adSlot = new Map<string, number>();
  for (const { task, min, max } of adSorted) {
    let s = 0;
    outer: while (true) {
      for (let c = min; c <= max; c++) { if (adOccupied[s][c]) { s++; continue outer; } }
      break;
    }
    for (let c = min; c <= max; c++) adOccupied[s][c] = true;
    adSlot.set(task.id, s);
  }
  const maxAllDay = adSorted.length ? Math.max(...adSorted.map(({ task }) => adSlot.get(task.id)!)) + 1 : 0;
  const alldaySectH = maxAllDay > 0 ? 6 + maxAllDay * (ALLDAY_TASK_H + ALLDAY_GAP) + 4 : 0;
  const colH = HOURS.length * HOUR_H + alldaySectH;

  return (
    <>
      {/* Day headers */}
      <div className={styles.chartHeaders}>
        <div className={styles.chartGutterHead}>
          {showWeekNum && (
            <span className={styles.weekNumLabel}>{getISOWeek(days[0])} неделя</span>
          )}
        </div>
        {days.map(d => {
          const ds       = toDateStr(d);
          const hol      = holidayMap?.get(ds);
          const holColor = hol ? getHolidayColor(hol.type) : undefined;
          const isToday  = ds === todStr;
          const isSel    = ds === selStr;
          return (
            <button key={ds}
              className={[
                styles.chartDayHead,
                isSel && !isToday ? styles.chartDaySelected : '',
              ].join(' ')}
              onClick={() => onSelect(d)}
              title={hol?.name || undefined}
            >
              {isToday ? (
                <span className={styles.chartTodayPill}>
                  {DAY_SHORT[d.getDay()]} {d.getDate()}
                </span>
              ) : (
                <span className={styles.chartDayLabel} style={holColor ? { color: holColor } : undefined}>
                  {DAY_SHORT[d.getDay()]} {d.getDate()}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className={styles.chartBody}>
        <div className={styles.chartGutter}>
          {/* All-day label first (above hours) */}
          {alldaySectH > 0 && (
            <div className={styles.alldayGutterLabel} style={{ height: alldaySectH }}>
              Весь день
            </div>
          )}
          {HOURS.map(h => (
            <div key={h} className={styles.chartHourLabel} style={{ height: HOUR_H }}>
              {pad(h)}:00
            </div>
          ))}
        </div>
        <div className={styles.chartCols}>
          {days.map((d, dayIdx) => {
            const ds       = toDateStr(d);
            const dayTasks = getTasksForDate(tasks, d, new Set(), holidayMap);
            const timed    = dayTasks.filter(t => t.time);
            const allDay   = dayTasks.filter(t => !t.time);
            const layout   = computeLayout(timed);
            const isToday  = ds === todStr;

            return (
              <div key={ds}
                className={[styles.chartCol, isToday ? styles.chartColToday : ''].join(' ')}
                style={{ height: colH }}
              >
                {/* Hour lines – start below the all-day section */}
                {HOURS.map(h => (
                  <div key={h} className={styles.chartHourLine}
                    style={{ top: alldaySectH + (h - 7) * HOUR_H, height: HOUR_H }}
                  />
                ))}

                {/* Divider line below all-day section */}
                {alldaySectH > 0 && (
                  <div className={styles.alldayDivider} style={{ top: alldaySectH }} />
                )}

                {/* Now line */}
                {isToday && showNow && (
                  <div className={styles.nowLine} style={{ top: alldaySectH + nowTop }} />
                )}

                {/* All-day tasks at TOP – use global slot map for proper spanning */}
                {allDay.map(t => {
                  const slot     = adSlot.get(t.id) ?? 0;
                  const range    = adRange.get(t.id);
                  const connL    = !!range && range.min < dayIdx;
                  const connR    = !!range && range.max > dayIdx;
                  // Only render on the leftmost day of a span – bar will extend right via width
                  if (connL) return null;
                  const spanLen  = range ? range.max - range.min + 1 : 1;
                  const tagStyle = taskColorStyle(t);
                  return (
                    <div key={t.id}
                      className={[
                        styles.chartTask,
                        styles.chartTaskAllDay,
                        !tagStyle ? (TYPE_CLS[t.type] ?? styles.chartTaskNormal) : '',
                      ].join(' ')}
                      style={{
                        top:    3 + slot * (ALLDAY_TASK_H + ALLDAY_GAP),
                        height: ALLDAY_TASK_H,
                        left:   2,
                        width:  `calc(${spanLen * 100}% + ${(spanLen - 1) * 1}px - 4px)`,
                        borderTopRightRadius:    connR ? 0 : 4,
                        borderBottomRightRadius: connR ? 0 : 4,
                        ...(tagStyle ? { background: tagStyle.background, color: tagStyle.color, border: 'none' } : {}),
                      }}
                      title={t.title}
                    >
                      <span className={styles.chartTaskBody}>
                        {t.repeat !== 'none' && <span className={styles.chartTaskRepeat}>↻</span>}
                        {t.title}
                      </span>
                    </div>
                  );
                })}

                {/* Timed tasks */}
                {timed.map(t => {
                  const [h, m] = t.time!.split(':').map(Number);
                  if (h < 7) return null;

                  const height = taskBlockHeight(t);
                  const isStripe = !!t.endDate || t.repeat === 'daily';
                  const prevDs   = dayIdx > 0 ? toDateStr(days[dayIdx - 1]) : null;
                  const nextDs   = dayIdx < days.length - 1 ? toDateStr(days[dayIdx + 1]) : null;
                  const connL    = isStripe && !!prevDs && taskActiveOn(t, prevDs);
                  const connR    = isStripe && !!nextDs && taskActiveOn(t, nextDs);

                  const { col, totalCols } = isStripe
                    ? { col: 0, totalCols: 1 }
                    : (layout.get(t.id) ?? { col: 0, totalCols: 1 });
                  const pct = 100 / totalCols;

                  const timeLabel = t.endTime ? `${t.time}–${t.endTime}` : t.time!;
                  const tagStyle  = taskColorStyle(t);

                  return (
                    <div key={t.id}
                      className={[
                        styles.chartTask,
                        !tagStyle ? (TYPE_CLS[t.type] ?? styles.chartTaskNormal) : '',
                        isStripe ? styles.chartTaskStripe : '',
                      ].join(' ')}
                      style={{
                        top:    alldaySectH + (h - 7 + m / 60) * HOUR_H,
                        height,
                        left:   connL ? -1 : `calc(2px + ${col * pct}%)`,
                        width:  connL && connR ? 'calc(100% + 2px)'
                               : connL         ? `calc(${pct}% - 1px)`
                               : connR         ? `calc(${pct}% - 3px)`
                               :                 `calc(${pct}% - 4px)`,
                        right:  'auto',
                        borderTopLeftRadius:    connL ? 0 : 3,
                        borderBottomLeftRadius: connL ? 0 : 3,
                        borderTopRightRadius:   connR ? 0 : 3,
                        borderBottomRightRadius:connR ? 0 : 3,
                        borderLeft: connL ? 'none' : tagStyle?.borderLeft,
                        ...(tagStyle ? { background: tagStyle.background, color: tagStyle.color } : {}),
                      }}
                      title={`${timeLabel} ${t.title}`}
                    >
                      {!connL && (
                        <span className={styles.chartTaskBody}>
                          <span className={styles.chartTaskTime}>
                            {t.repeat !== 'none' && '↻ '}{timeLabel}
                          </span>
                          {' '}
                          <span className={styles.chartTaskTitle}>{t.title}</span>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── SpanMonthView ─────────────────────────────────────────────
interface SpanMonthViewProps {
  year: number; month: number;
  tasks: Task[]; selectedDate: Date; onSelect: (d: Date) => void;
  holidayMap?: HolidayMap;
  showMonthLabel?: boolean;
}

function SpanMonthView({ year, month, tasks, selectedDate, onSelect, holidayMap, showMonthLabel }: SpanMonthViewProps) {
  const today  = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const todStr = toDateStr(today);
  const selStr = toDateStr(selectedDate);
  const weeks  = useMemo(() => buildWeeks(year, month), [year, month]);
  const weekHeight = SPAN_HEAD_H + SPAN_MAX_SLOTS * SPAN_SLOT_H + 6;

  return (
    <div className={styles.spanMonth}>
      {showMonthLabel && <div className={styles.spanMonthTitle}>{MONTHS[month]}</div>}
      {/* Weekday headers – only show when not in stacked quarter mode */}
      {!showMonthLabel && (
        <div className={styles.spanMonthHead}>
          {WEEKDAYS.map(d => <span key={d} className={styles.spanMonthWd}>{d}</span>)}
        </div>
      )}
      {weeks.map((week, wi) => {
        const { spans, overflow } = computeWeekSpans(week, tasks, holidayMap);
        return (
          <div key={wi} className={styles.spanWeek} style={{ minHeight: weekHeight }}>
            {/* Background day cells */}
            {week.map((date, di) => {
              const ds        = toDateStr(date);
              const isInMonth = date.getMonth() === month;
              const isToday   = ds === todStr;
              const isSel     = ds === selStr;
              const hol       = holidayMap?.get(ds);
              const dow       = date.getDay();
              const isWeekend = dow === 0 || dow === 6;
              const isWorkday = hol?.type === 'workday';
              const numColor  = (isWeekend && !isWorkday) || hol?.type === 'holiday' ? '#ef4444' : undefined;
              return (
                <div key={di}
                  className={[styles.spanCell, !isInMonth ? styles.spanCellOut : '', isToday ? styles.spanCellToday : '', isSel ? styles.spanCellSel : ''].join(' ')}
                  onClick={() => onSelect(date)}
                >
                  <span className={styles.spanDayNum} style={numColor ? { color: numColor } : undefined}>
                    {date.getDate()}
                  </span>
                  {overflow[di] > 0 && <span className={styles.spanOverflow}>+{overflow[di]}</span>}
                </div>
              );
            })}
            {/* Spanning task bars */}
            {spans.map(({ task, startCol, endCol, slot, continuesLeft, continuesRight }) => (
              <div key={`${task.id}-${startCol}`}
                className={[styles.spanBar, TYPE_CLS[task.type] ?? styles.chartTaskNormal].join(' ')}
                style={{
                  top:   SPAN_HEAD_H + slot * SPAN_SLOT_H,
                  left:  `calc(${startCol} / 7 * 100% + ${continuesLeft ? 0 : 2}px)`,
                  width: `calc(${endCol - startCol + 1} / 7 * 100% - ${continuesLeft ? 0 : 2}px - ${continuesRight ? 0 : 2}px)`,
                  borderTopLeftRadius:     continuesLeft  ? 0 : 3,
                  borderBottomLeftRadius:  continuesLeft  ? 0 : 3,
                  borderTopRightRadius:    continuesRight ? 0 : 3,
                  borderBottomRightRadius: continuesRight ? 0 : 3,
                }}
                title={task.title}
              >
                {!continuesLeft && task.repeat !== 'none' && <span className={styles.spanBarRepeat}>↻ </span>}
                {!continuesLeft && <span className={styles.spanBarTitle}>{task.title}</span>}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── YearView ──────────────────────────────────────────────────
// Weekday-aligned year grid:
//   header: "Месяц | Пн Вт Ср Чт Пт Сб Вс Пн Вт …"  (37 day columns)
//   each month row places its days at columns offset by the weekday of the 1st
const YR_COLS    = 37;            // 5 full weeks + 2 days – fits any month (max offset 6 + 31 days)
const YR_SLOT_H  = 18;            // px per task slot
const YR_HEAD_H  = 18;            // px for the day-number row
const YR_MAX_SL  = 2;             // visible task slots per month before "+N"

interface YearViewProps {
  year: number; tasks: Task[]; selectedDate: Date; onSelect: (d: Date) => void; holidayMap?: HolidayMap;
}

function YearView({ year, tasks, selectedDate, onSelect, holidayMap }: YearViewProps) {
  const today  = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const todStr = toDateStr(today);
  const selStr = toDateStr(selectedDate);
  const rowH   = YR_HEAD_H + YR_MAX_SL * YR_SLOT_H + 4;

  return (
    <div className={styles.yearView}>
      {/* Header: month label + repeating weekday abbreviations */}
      <div className={styles.yearHeader}>
        <div className={styles.yearLabelCell}>Месяц</div>
        {Array.from({ length: YR_COLS }, (_, i) => {
          const dow = i % 7;
          const isWeekend = dow === 5 || dow === 6;
          return (
            <span
              key={i}
              className={[styles.yearHeaderWd, isWeekend ? styles.yearHeaderWdOff : ''].join(' ')}
            >
              {WEEKDAYS[dow]}
            </span>
          );
        })}
      </div>

      {Array.from({ length: 12 }, (_, mi) => {
        const dim = new Date(year, mi + 1, 0).getDate();
        // Day of week of the 1st (Mon = 0)
        const firstDow = (new Date(year, mi, 1).getDay() + 6) % 7;

        // Collect tasks active in this month
        const taskMap = new Map<string, { task: Task; days: number[] }>();
        for (let d = 1; d <= dim; d++) {
          const dt = new Date(year, mi, d);
          for (const t of getTasksForDate(tasks, dt, new Set(), holidayMap)) {
            const e = taskMap.get(t.id);
            if (!e) taskMap.set(t.id, { task: t, days: [d] });
            else e.days.push(d);
          }
        }

        // Разбиваем дни задачи на непрерывные отрезки (удалённый день рвёт полосу)
        const mStr = `${year}-${String(mi + 1).padStart(2, '0')}`;
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

        // Slot assignment (все отрезки задачи — на одном слоте)
        const occ = Array.from({ length: 20 }, () => Array(32).fill(false));
        const spans: Array<{ task: Task; sd: number; ed: number; slot: number; cL: boolean; cR: boolean }> = [];
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

        return (
          <div key={mi} className={styles.yearRow}>
            <div className={styles.yearLabelCell}>{MONTHS_SHORT[mi]}</div>
            <div className={styles.yearRowArea} style={{ height: rowH }}>
              {/* Day cells positioned by weekday */}
              {Array.from({ length: YR_COLS }, (_, ci) => {
                const dayNum = ci - firstDow + 1;
                const cellLeft  = `${(ci / YR_COLS) * 100}%`;
                const cellWidth = `${(1 / YR_COLS) * 100}%`;
                if (dayNum < 1 || dayNum > dim) {
                  return (
                    <div
                      key={ci}
                      className={styles.yearDayCellEmpty}
                      style={{ left: cellLeft, width: cellWidth }}
                    />
                  );
                }
                const date  = new Date(year, mi, dayNum);
                const ds    = toDateStr(date);
                const hol   = holidayMap?.get(ds);
                const dow   = date.getDay();
                const isWk  = dow === 0 || dow === 6;
                const isWd  = hol?.type === 'workday';
                const nc    = (isWk && !isWd) || hol?.type === 'holiday' ? '#ef4444' : undefined;
                const isT   = ds === todStr;
                const isS   = ds === selStr;
                return (
                  <div
                    key={ci}
                    className={[
                      styles.yearDayCell,
                      isT ? styles.yearDayCellToday : '',
                      isS ? styles.yearDayCellSel   : '',
                    ].join(' ')}
                    style={{ left: cellLeft, width: cellWidth }}
                    onClick={() => onSelect(date)}
                  >
                    <span className={styles.yearDayNum} style={nc ? { color: nc } : undefined}>
                      {dayNum}
                    </span>
                    {ovfl[dayNum] > 0 && <span className={styles.yearOverflow}>+{ovfl[dayNum]}</span>}
                  </div>
                );
              })}

              {/* Task bars – positioned by firstDow + day-1 */}
              {vis.map(({ task, sd, ed, slot, cL, cR }) => {
                const startCol = firstDow + sd - 1;
                const span     = ed - sd + 1;
                const tagStyle = taskColorStyle(task);
                return (
                  <div
                    key={`${task.id}-${sd}`}
                    className={[
                      styles.yearBar,
                      !tagStyle ? (TYPE_CLS[task.type] ?? styles.chartTaskNormal) : '',
                    ].join(' ')}
                    style={{
                      top:    YR_HEAD_H + slot * YR_SLOT_H,
                      left:   `${(startCol / YR_COLS) * 100}%`,
                      width:  `${(span / YR_COLS) * 100}%`,
                      borderTopLeftRadius:     cL ? 0 : 3,
                      borderBottomLeftRadius:  cL ? 0 : 3,
                      borderTopRightRadius:    cR ? 0 : 3,
                      borderBottomRightRadius: cR ? 0 : 3,
                      ...(tagStyle ? { background: tagStyle.background, color: tagStyle.color, border: 'none' } : {}),
                    }}
                    title={task.title}
                  >
                    {!cL && (
                      <span className={styles.yearBarTitle}>
                        {task.repeat !== 'none' && '↻ '}{task.title}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface ChartProps { selectedDate: Date; tasks: Task[]; onSelect: (d: Date) => void; holidayMap?: HolidayMap; }

function ChartView({ selectedDate, tasks, onSelect, holidayMap }: ChartProps) {
  const [period,      setPeriod]      = useState<ChartPeriod>('week');
  const [chartPicker, setChartPicker] = useState<PickerType | null>(null);

  const today    = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

  const navigate = (dir: 1 | -1) => {
    const d = new Date(selectedDate);
    switch (period) {
      case 'day':     d.setDate(d.getDate() + dir);         break;
      case 'week':    d.setDate(d.getDate() + dir * 7);     break;
      case 'month':   d.setMonth(d.getMonth() + dir);       break;
      case 'quarter': d.setMonth(d.getMonth() + dir * 3);   break;
      case 'year':    d.setFullYear(d.getFullYear() + dir); break;
    }
    onSelect(d);
  };

  const handleChartPick = (month: number, year: number) => {
    const d = new Date(year, month, 1); d.setHours(0,0,0,0); onSelect(d);
    setChartPicker(null);
  };

  const navLabel = (() => {
    switch (period) {
      case 'day': {
        const t = new Date(); t.setHours(0,0,0,0);
        const isTodaySel = selectedDate.getTime() === t.getTime();
        const dateStr = `${selectedDate.getDate()} ${MONTHS_GEN[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
        return isTodaySel ? `Сегодня: ${dateStr}` : dateStr;
      }
      case 'week': {
        const f = weekDays[0], l = weekDays[6];
        if (f.getMonth() === l.getMonth())
          return `${f.getDate()}–${l.getDate()} ${MONTHS_GEN[f.getMonth()]} ${f.getFullYear()}`;
        return `${f.getDate()} ${MONTHS_GEN[f.getMonth()]} – ${l.getDate()} ${MONTHS_GEN[l.getMonth()]} ${l.getFullYear()}`;
      }
      case 'month':   return `${MONTHS[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
      case 'quarter': return `${QUARTERS[Math.floor(selectedDate.getMonth()/3)]} ${selectedDate.getFullYear()}`;
      case 'year':    return `${selectedDate.getFullYear()}`;
    }
  })();

  const qStart        = Math.floor(selectedDate.getMonth() / 3) * 3;
  const quarterMonths = [0,1,2].map(i => ({ year: selectedDate.getFullYear(), month: qStart + i }));
  const yearMonths    = Array.from({ length: 12 }, (_, i) => ({ year: selectedDate.getFullYear(), month: i }));

  const todStr = toDateStr(today);
  const selStr = toDateStr(selectedDate);
  const now    = new Date();
  const nowTop = ((now.getHours() + now.getMinutes()/60) - 7) * HOUR_H;
  const showNow = now.getHours() >= 7 && now.getHours() < 23;

  return (
    <div className={styles.chart}>
      {/* Nav row */}
      <div className={styles.chartNavRow}>
        <div className={styles.chartNavLeft}>
          <button className={styles.navBtn} onClick={() => navigate(-1)} aria-label="Назад">‹</button>
          <span className={styles.chartWeekLabel}>{navLabel}</span>
          <button className={styles.navBtn} onClick={() => navigate(1)} aria-label="Вперёд">›</button>

          {/* Month/Year pickers for chart */}
          <div className={styles.chartPickerGroup}>
            {period !== 'year' && (
              <div className={styles.pickerWrap}>
                <button
                  className={[styles.navPickerBtn, chartPicker === 'month' ? styles.navPickerBtnActive : ''].join(' ')}
                  onClick={() => setChartPicker(p => p === 'month' ? null : 'month')}
                >
                  {MONTHS_SHORT[selectedDate.getMonth()]} ▾
                </button>
                {chartPicker === 'month' && (
                  <PickerPanel
                    type="month"
                    currentMonth={selectedDate.getMonth()}
                    currentYear={selectedDate.getFullYear()}
                    onPick={handleChartPick}
                    onClose={() => setChartPicker(null)}
                  />
                )}
              </div>
            )}
            <div className={styles.pickerWrap}>
              <button
                className={[styles.navPickerBtn, chartPicker === 'year' ? styles.navPickerBtnActive : ''].join(' ')}
                onClick={() => setChartPicker(p => p === 'year' ? null : 'year')}
              >
                {selectedDate.getFullYear()} ▾
              </button>
              {chartPicker === 'year' && (
                <PickerPanel
                  type="year"
                  currentMonth={selectedDate.getMonth()}
                  currentYear={selectedDate.getFullYear()}
                  onPick={handleChartPick}
                  onClose={() => setChartPicker(null)}
                />
              )}
            </div>
          </div>
        </div>

        <div className={styles.chartPeriods}>
          {(Object.keys(PERIOD_LABELS) as ChartPeriod[]).map(p => (
            <button key={p}
              className={[styles.periodBtn, period === p ? styles.periodBtnActive : ''].join(' ')}
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Day ── */}
      {period === 'day' && (
        <TimeGridView days={[selectedDate]} tasks={tasks} selectedDate={selectedDate} onSelect={onSelect} holidayMap={holidayMap} />
      )}

      {/* ── Week ── */}
      {period === 'week' && (
        <TimeGridView days={weekDays} tasks={tasks} selectedDate={selectedDate} onSelect={onSelect} holidayMap={holidayMap} showWeekNum />
      )}

      {period === 'month' && (
        <div className={styles.chartSingleMonth}>
          <SpanMonthView year={selectedDate.getFullYear()} month={selectedDate.getMonth()} tasks={tasks} selectedDate={selectedDate} onSelect={onSelect} holidayMap={holidayMap} />
        </div>
      )}
      {period === 'quarter' && (
        <div className={styles.chartQuarterStack}>
          <div className={styles.spanMonthHead}>
            {WEEKDAYS.map(d => <span key={d} className={styles.spanMonthWd}>{d}</span>)}
          </div>
          {quarterMonths.map(({ year, month }) => (
            <SpanMonthView key={month} year={year} month={month} tasks={tasks} selectedDate={selectedDate} onSelect={onSelect} holidayMap={holidayMap} showMonthLabel />
          ))}
        </div>
      )}
      {period === 'year' && (
        <div className={styles.chartYearWrap}>
          <YearView year={selectedDate.getFullYear()} tasks={tasks} selectedDate={selectedDate} onSelect={onSelect} holidayMap={holidayMap} />
        </div>
      )}
    </div>
  );
}

// ── Main calendar ─────────────────────────────────────────────
interface Props { selectedDate: Date; onSelect: (d: Date) => void; tasks: Task[]; }

export function ManagerCalendar({ selectedDate, onSelect, tasks }: Props) {
  const [viewYear,    setViewYear]    = useState(selectedDate.getFullYear());
  const [viewMonth,   setViewMonth]   = useState(selectedDate.getMonth());
  const [view,        setView]        = useState<'grid' | 'chart'>('grid');
  const [gridPicker,  setGridPicker]  = useState<PickerType | null>(null);

  const today = new Date(); today.setHours(0,0,0,0);

  const { user } = useAuthStore();
  const { data: weather } = useCalendarWeather(viewYear, viewMonth, {
    lat:  user?.locationLat,
    lon:  user?.locationLon,
    name: user?.location,
  });

  const weatherShownLock = useWeatherShownLock();
  const todayStr = toDateStr(today);

  const showHolidays = user?.showHolidays !== false; // default true
  const { data: holCur  } = useHolidays(viewYear,     showHolidays);
  const { data: holNext } = useHolidays(viewYear + 1, showHolidays);
  const holidayMap = useMemo<HolidayMap>(() => {
    if (!showHolidays) return new Map();
    const m: HolidayMap = new Map();
    for (const e of [...(holCur ?? []), ...(holNext ?? [])]) m.set(e.date, e);
    return m;
  }, [showHolidays, holCur, holNext]);

  useEffect(() => {
    setViewYear(selectedDate.getFullYear());
    setViewMonth(selectedDate.getMonth());
  }, [selectedDate]);

  const prevMonth = () => { if (viewMonth===0){setViewYear(y=>y-1);setViewMonth(11);}else setViewMonth(m=>m-1); };
  const nextMonth = () => { if (viewMonth===11){setViewYear(y=>y+1);setViewMonth(0);}else setViewMonth(m=>m+1); };

  const handleGridPick = (month: number, year: number) => {
    setViewMonth(month); setViewYear(year);
    const d = new Date(year, month, selectedDate.getDate() <= new Date(year, month+1, 0).getDate()
      ? selectedDate.getDate() : 1);
    d.setHours(0,0,0,0); onSelect(d);
    setGridPicker(null);
  };

  const cells = buildCells(viewYear, viewMonth);

  const isSelected = (day: number) =>
    selectedDate.getFullYear()===viewYear && selectedDate.getMonth()===viewMonth && selectedDate.getDate()===day;
  const isToday = (day: number) =>
    today.getFullYear()===viewYear && today.getMonth()===viewMonth && today.getDate()===day;

  const handleDayClick = (day: number) => {
    const d = new Date(viewYear, viewMonth, day); d.setHours(0,0,0,0); onSelect(d);
  };

  const renderTagIcons = (dayTasks: Task[]) => {
    // Собираем уникальные теги дня (первый тег каждой задачи)
    const seen = new Set<string>();
    const tagItems: Array<{ id: string; icon: string | null; color: string }> = [];
    for (const t of dayTasks) {
      if (!t.tags?.length) continue;
      const tag = t.tags[0];
      if (!seen.has(tag.id)) { seen.add(tag.id); tagItems.push(tag); }
      if (tagItems.length >= 4) break;
    }
    const noTagCount = dayTasks.filter(t => !t.tags?.length).length;
    const extra = dayTasks.length - tagItems.length - noTagCount;
    return (
      <>
        {tagItems.map(tag => {
          const Ic = tag.icon ? Icons[tag.icon] : null;
          return Ic
            ? <Ic key={tag.id} size={9} strokeWidth={2.5} color={tag.color} />
            : <span key={tag.id} className={styles.dot} style={{ background: tag.color }} />;
        })}
        {noTagCount > 0 && <span className={styles.dot} />}
        {extra > 0 && <span className={styles.dotPlus}>+{extra}</span>}
      </>
    );
  };

  return (
    <div className={styles.root}>
      {/* Common head */}
      <div className={styles.head}>
        {view === 'grid' ? (
          <div className={styles.nav}>
            <button className={styles.navBtn} onClick={prevMonth} aria-label="Предыдущий месяц">‹</button>

            {/* Month · Year – fixed-width group so layout stays stable on month change */}
            <div className={styles.navCenter}>
              <div className={styles.pickerWrap}>
                <button
                  className={[styles.navPickerBtn, gridPicker === 'month' ? styles.navPickerBtnActive : ''].join(' ')}
                  onClick={() => setGridPicker(p => p === 'month' ? null : 'month')}
                >
                  {MONTHS[viewMonth]} ▾
                </button>
                {gridPicker === 'month' && (
                  <PickerPanel
                    type="month"
                    currentMonth={viewMonth}
                    currentYear={viewYear}
                    onPick={handleGridPick}
                    onClose={() => setGridPicker(null)}
                  />
                )}
              </div>

              <span className={styles.navSep}>·</span>

              <div className={styles.pickerWrap}>
                <button
                  className={[styles.navPickerBtn, gridPicker === 'year' ? styles.navPickerBtnActive : ''].join(' ')}
                  onClick={() => setGridPicker(p => p === 'year' ? null : 'year')}
                >
                  {viewYear} ▾
                </button>
                {gridPicker === 'year' && (
                  <PickerPanel
                    type="year"
                    currentMonth={viewMonth}
                    currentYear={viewYear}
                    onPick={handleGridPick}
                    onClose={() => setGridPicker(null)}
                  />
                )}
              </div>
            </div>

            <button className={styles.navBtn} onClick={nextMonth} aria-label="Следующий месяц">›</button>
          </div>
        ) : (
          <div className={styles.nav} />
        )}
        <div className={styles.viewToggle}>
          <button className={[styles.viewBtn, view==='grid'  ? styles.viewBtnActive : ''].join(' ')} onClick={()=>setView('grid')}  title="Сетка"   aria-label="Вид: сетка"   aria-pressed={view==='grid'}>⊞</button>
          <button className={[styles.viewBtn, view==='chart' ? styles.viewBtnActive : ''].join(' ')} onClick={()=>setView('chart')} title="График" aria-label="Вид: график" aria-pressed={view==='chart'}>≡</button>
        </div>
      </div>

      {view === 'grid' ? (
        <div className={styles.gridWrap}>
          <div className={styles.weekdays}>
            {WEEKDAYS.map((d) => (
              <span key={d} className={styles.weekday}>{d}</span>
            ))}
          </div>
          <div className={styles.grid}>
            {cells.map((day, i) => {
              if (!day) return <div key={i} className={styles.empty} />;
              const d        = new Date(viewYear, viewMonth, day);
              const ds       = toDateStr(d);
              const dow      = d.getDay(); // 0=Sun, 6=Sat
              const dayTasks = getTasksForDate(tasks, d, new Set(), holidayMap, weather, { todayStr, weatherShownLock });
              const tempMax  = weather?.get(ds)?.tempMax;
              const hol      = holidayMap.get(ds);
              const isWeekend = dow === 0 || dow === 6;
              const isWorkday = hol?.type === 'workday';
              const isOff     = (isWeekend && !isWorkday) || hol?.type === 'holiday';
              const cellTitle = hol?.type === 'holiday'  ? (hol.name || getHolidayName(ds))
                              : hol?.type === 'shortday' ? 'Сокращённый день'
                              : hol?.type === 'workday'  ? 'Рабочая суббота'
                              : isOff                    ? 'Выходной'
                              : undefined;
              return (
                <button key={i}
                  className={[
                    styles.cell,
                    isOff           ? styles.cellWeekend  : '',
                    isSelected(day) ? styles.cellSelected : '',
                    isToday(day)    ? styles.cellToday    : '',
                  ].join(' ')}
                  onClick={() => handleDayClick(day)}
                  title={cellTitle}
                >
                  <span className={styles.dayNum}>{day}</span>
                  <span className={styles.temp}>{tempMax != null ? (tempMax > 0 ? `+${tempMax}` : tempMax) + '°' : 't°'}</span>
                  {hol && (
                    <span className={styles.holBadge} style={{ background: getHolidayColor(hol.type) }}>
                      {hol.type === 'workday' ? 'Р' : hol.type === 'shortday' ? '½' : '●'}
                    </span>
                  )}
                  <div className={styles.dots}>{renderTagIcons(dayTasks)}</div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <ChartView selectedDate={selectedDate} tasks={tasks} onSelect={onSelect} holidayMap={holidayMap} />
      )}
    </div>
  );
}
