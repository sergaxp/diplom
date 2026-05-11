'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Task, toDateStr, getTasksForDate } from '../../lib/tasks';

type LucideIcon = React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
const Icons = LucideIcons as unknown as Record<string, LucideIcon>;
import { useMonthWeather } from '../../lib/weather';
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

type ChartPeriod = 'week' | 'month' | 'quarter' | 'year';
const PERIOD_LABELS: Record<ChartPeriod, string> = {
  week: 'Нед', month: 'Мес', quarter: 'Кв', year: 'Год',
};

const HOURS         = Array.from({ length: 17 }, (_, i) => i + 7); // 7–23
const HOUR_H        = 52;
const TASK_H        = Math.max(Math.round(HOUR_H * 0.65), 30);      // ~34px
const TASK_MINS     = Math.ceil((TASK_H / HOUR_H) * 60);             // ~40 мин — окно перекрытия
const ALLDAY_TASK_H = 22;
const ALLDAY_GAP    = 3;

function pad(n: number) { return String(n).padStart(2, '0'); }

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
  if (!t.endDate || t.repeat === 'none') return false;
  if (t.repeatUntil && dateStr > t.repeatUntil) return false;

  const checkDate = new Date(dateStr    + 'T00:00:00');
  const origStart = new Date(t.date     + 'T00:00:00');
  const origEnd   = new Date(t.endDate  + 'T00:00:00');

  if (checkDate < origStart) return false;

  const durationDays = Math.round((origEnd.getTime() - origStart.getTime()) / 86_400_000);

  if (t.repeat === 'daily') return true;

  let occStart: Date;
  if (t.repeat === 'weekly') {
    const dayDiff = (checkDate.getDay() - origStart.getDay() + 7) % 7;
    occStart = new Date(checkDate);
    occStart.setDate(occStart.getDate() - dayDiff);
  } else if (t.repeat === 'monthly') {
    occStart = new Date(checkDate.getFullYear(), checkDate.getMonth(), origStart.getDate());
    if (occStart > checkDate) occStart.setMonth(occStart.getMonth() - 1);
  } else if (t.repeat === 'yearly') {
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
}

function MiniMonth({ year, month, tasks, selectedDate, onSelect, compact }: MiniMonthProps) {
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
          const n  = getTasksForDate(tasks, d).length;
          return (
            <button key={i}
              className={[styles.miniCell,
                ds === todStr ? styles.miniCellToday    : '',
                ds === selStr ? styles.miniCellSelected : '',
                n > 0         ? styles.miniCellHasTasks : '',
              ].join(' ')}
              onClick={() => onSelect(d)}
              title={n > 0 ? `${n} задач` : undefined}
            >
              {day}
              {n > 0 && !compact && <span className={styles.miniDot} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Chart view ────────────────────────────────────────────────
const TYPE_CLS: Record<string, string> = {
  mandatory: styles.chartTaskMandatory,
  event:     styles.chartTaskEvent,
  normal:    styles.chartTaskNormal,
};

interface ChartProps { selectedDate: Date; tasks: Task[]; onSelect: (d: Date) => void; }

function ChartView({ selectedDate, tasks, onSelect }: ChartProps) {
  const [period,      setPeriod]      = useState<ChartPeriod>('week');
  const [chartPicker, setChartPicker] = useState<PickerType | null>(null);

  const today    = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

  const navigate = (dir: 1 | -1) => {
    const d = new Date(selectedDate);
    switch (period) {
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
          <button className={styles.navBtn} onClick={() => navigate(-1)}>‹</button>
          <span className={styles.chartWeekLabel}>{navLabel}</span>
          <button className={styles.navBtn} onClick={() => navigate(1)}>›</button>

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

      {/* ── Week ── */}
      {period === 'week' && (
        <>
          <div className={styles.chartHeaders}>
            <div className={styles.chartGutterHead} />
            {weekDays.map(d => {
              const ds = toDateStr(d);
              return (
                <button key={ds}
                  className={[styles.chartDayHead,
                    ds === todStr ? styles.chartDayToday    : '',
                    ds === selStr ? styles.chartDaySelected : '',
                  ].join(' ')}
                  onClick={() => onSelect(d)}
                >
                  <span className={styles.chartDayName}>{DAY_SHORT[d.getDay()]}</span>
                  <span className={styles.chartDayNum}>{d.getDate()}</span>
                </button>
              );
            })}
          </div>
          {(() => {
            const maxAllDay = Math.max(0, ...weekDays.map(d =>
              getTasksForDate(tasks, d).filter(t => !t.time).length,
            ));
            const alldaySectH = maxAllDay > 0
              ? 14 + maxAllDay * (ALLDAY_TASK_H + ALLDAY_GAP) + 8
              : 0;
            const colH    = HOURS.length * HOUR_H + alldaySectH;
            const alldayY = HOURS.length * HOUR_H + 10;

            return (
              <div className={styles.chartBody}>
                <div className={styles.chartGutter}>
                  {HOURS.map(h => (
                    <div key={h} className={styles.chartHourLabel} style={{ height: HOUR_H }}>
                      {pad(h)}:00
                    </div>
                  ))}
                  {alldaySectH > 0 && (
                    <div className={styles.alldayGutterLabel} style={{ height: alldaySectH }}>
                      без<br />вр.
                    </div>
                  )}
                </div>
                <div className={styles.chartCols}>
                  {weekDays.map((d, dayIdx) => {
                    const ds       = toDateStr(d);
                    const dayTasks = getTasksForDate(tasks, d);
                    const timed    = dayTasks.filter(t => t.time);
                    const allDay   = dayTasks.filter(t => !t.time);
                    const layout   = computeLayout(timed);
                    return (
                      <div key={ds}
                        className={[styles.chartCol, ds === todStr ? styles.chartColToday : ''].join(' ')}
                        style={{ height: colH }}
                      >
                        {HOURS.map(h => (
                          <div key={h} className={styles.chartHourLine} style={{ top: (h - 7) * HOUR_H, height: HOUR_H }} />
                        ))}

                        {/* Разделитель «без времени» */}
                        {alldaySectH > 0 && (
                          <div className={styles.alldayDivider} style={{ top: alldayY - 10 }} />
                        )}

                        {ds === todStr && showNow && (
                          <div className={styles.nowLine} style={{ top: nowTop }} />
                        )}

                        {/* Задачи со временем — с раскладкой колонок */}
                        {timed.map(t => {
                          const [h, m] = t.time!.split(':').map(Number);
                          if (h < 7) return null;

                          const height = taskBlockHeight(t);

                          // Полоса: многодневные и ежедневно-повторяющиеся
                          const isStripe = !!t.endDate || t.repeat === 'daily';
                          const prevDs   = dayIdx > 0 ? toDateStr(weekDays[dayIdx - 1]) : null;
                          const nextDs   = dayIdx < 6 ? toDateStr(weekDays[dayIdx + 1]) : null;
                          const connL    = isStripe && !!prevDs && taskActiveOn(t, prevDs);
                          const connR    = isStripe && !!nextDs && taskActiveOn(t, nextDs);

                          const { col, totalCols } = isStripe
                            ? { col: 0, totalCols: 1 }
                            : (layout.get(t.id) ?? { col: 0, totalCols: 1 });
                          const pct = 100 / totalCols;

                          const timeLabel = t.endTime ? `${t.time}–${t.endTime}` : t.time!;

                          return (
                            <div key={t.id}
                              className={[
                                styles.chartTask,
                                TYPE_CLS[t.type] ?? styles.chartTaskNormal,
                                isStripe ? styles.chartTaskStripe : '',
                              ].join(' ')}
                              style={{
                                top:                  (h - 7 + m / 60) * HOUR_H,
                                height,
                                left:   connL ? -1    : `calc(2px + ${col * pct}%)`,
                                width:  connL && connR ? 'calc(100% + 2px)'
                                       : connL         ? `calc(${pct}% - 1px)`
                                       : connR         ? `calc(${pct}% - 3px)`
                                       :                 `calc(${pct}% - 4px)`,
                                right:  'auto',
                                borderTopLeftRadius:    connL ? 0 : 3,
                                borderBottomLeftRadius: connL ? 0 : 3,
                                borderTopRightRadius:   connR ? 0 : 3,
                                borderBottomRightRadius:connR ? 0 : 3,
                              }}
                              title={`${timeLabel} ${t.title}`}
                            >
                              <span className={styles.chartTaskTime}>{timeLabel}</span>
                              <span className={styles.chartTaskTitle}>{t.title}</span>
                            </div>
                          );
                        })}

                        {/* Задачи без времени — под 23:59 */}
                        {allDay.map((t, idx) => (
                          <div key={t.id}
                            className={[styles.chartTask, styles.chartTaskAllDay, TYPE_CLS[t.type] ?? styles.chartTaskNormal].join(' ')}
                            style={{
                              top:    alldayY + idx * (ALLDAY_TASK_H + ALLDAY_GAP),
                              height: ALLDAY_TASK_H,
                              left:   2,
                              right:  2,
                            }}
                            title={t.title}
                          >
                            <span className={styles.chartTaskTitle}>{t.title}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </>
      )}

      {period === 'month'   && <div className={styles.chartSingleMonth}><MiniMonth year={selectedDate.getFullYear()} month={selectedDate.getMonth()} tasks={tasks} selectedDate={selectedDate} onSelect={onSelect} /></div>}
      {period === 'quarter' && <div className={styles.chartQuarter}>{quarterMonths.map(({ year, month }) => <MiniMonth key={month} year={year} month={month} tasks={tasks} selectedDate={selectedDate} onSelect={onSelect} />)}</div>}
      {period === 'year'    && <div className={styles.chartYear}>{yearMonths.map(({ year, month }) => <MiniMonth key={month} year={year} month={month} compact tasks={tasks} selectedDate={selectedDate} onSelect={onSelect} />)}</div>}
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
  const { data: weather } = useMonthWeather(viewYear, viewMonth, {
    lat:  user?.locationLat,
    lon:  user?.locationLon,
    name: user?.location,
  });

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
            <button className={styles.navBtn} onClick={prevMonth}>‹</button>

            {/* Clickable month */}
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

            {/* Clickable year */}
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

            <button className={styles.navBtn} onClick={nextMonth}>›</button>
          </div>
        ) : (
          <div className={styles.nav} />
        )}
        <div className={styles.viewToggle}>
          <button className={[styles.viewBtn, view==='grid'  ? styles.viewBtnActive : ''].join(' ')} onClick={()=>setView('grid')}  title="Сетка">⊞</button>
          <button className={[styles.viewBtn, view==='chart' ? styles.viewBtnActive : ''].join(' ')} onClick={()=>setView('chart')} title="График">≡</button>
        </div>
      </div>

      {view === 'grid' ? (
        <div className={styles.gridWrap}>
          <div className={styles.weekdays}>
            {WEEKDAYS.map(d => <span key={d} className={styles.weekday}>{d}</span>)}
          </div>
          <div className={styles.grid}>
            {cells.map((day, i) => {
              if (!day) return <div key={i} className={styles.empty} />;
              const dayTasks = getTasksForDate(tasks, new Date(viewYear, viewMonth, day));
              const ds       = toDateStr(new Date(viewYear, viewMonth, day));
              const tempMax  = weather?.get(ds)?.tempMax;
              return (
                <button key={i}
                  className={[styles.cell, isSelected(day)?styles.cellSelected:'', isToday(day)?styles.cellToday:''].join(' ')}
                  onClick={() => handleDayClick(day)}
                >
                  <span className={styles.dayNum}>{day}</span>
                  <span className={styles.temp}>{tempMax != null ? (tempMax > 0 ? `+${tempMax}` : tempMax) + '°' : 't°'}</span>
                  <div className={styles.dots}>{renderTagIcons(dayTasks)}</div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <ChartView selectedDate={selectedDate} tasks={tasks} onSelect={onSelect} />
      )}
    </div>
  );
}
