'use client';

import { useEffect, useMemo, useState } from 'react';
import { Task, toDateStr, getTasksForDate } from '../../lib/tasks';
import { useMonthWeather, useCurrentWeather } from '../../lib/weather';
import { useAuthStore } from '../../store/authStore';
import { useHolidays, HolidayMap, getHolidayColor } from '../../lib/holidays';
import styles from './MobileDayStrip.module.scss';

const MONTH_GEN  = ['января','февраля','марта','апреля','мая','июня',
                    'июля','августа','сентября','октября','ноября','декабря'];
const WEEKDAYS   = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const DAY_SHORT  = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const MONTHS     = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                    'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

interface Props {
  selectedDate: Date;
  onSelect: (d: Date) => void;
  tasks: Task[];
  /** Toggle showing the full month grid below the strip. */
  expanded: boolean;
  onToggleExpand: () => void;
  onGoToToday: () => void;
}

const PRIORITY_ORDER: Record<string, number> = { high: 4, medium: 3, low: 2, none: 1 };

function taskDotColors(tasks: Task[]): string[] {
  const sorted = [...tasks].sort(
    (a, b) => (PRIORITY_ORDER[b.priority ?? 'none'] ?? 1) - (PRIORITY_ORDER[a.priority ?? 'none'] ?? 1),
  );
  return sorted.slice(0, 9).map(t => {
    if (t.type === 'mandatory') return '#dc2626';
    if (t.priority === 'high')   return '#ef4444';
    if (t.priority === 'medium') return '#3b82f6';
    if (t.priority === 'low')    return '#eab308';
    if (t.tags?.[0]?.color)      return t.tags[0].color;
    return 'var(--text-muted)';
  });
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

export function MobileDayStrip({ selectedDate, onSelect, tasks, expanded, onToggleExpand, onGoToToday }: Props) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(t); }, []);

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const user  = useAuthStore(s => s.user);
  const showHolidays = user?.showHolidays !== false;

  const { user: u } = useAuthStore();
  const location = { lat: u?.locationLat, lon: u?.locationLon, name: u?.location };
  const { data: weather } = useMonthWeather(selectedDate.getFullYear(), selectedDate.getMonth(), location);
  const { data: currentWeather } = useCurrentWeather(location);

  // 4 day cards centered around selectedDate (yesterday, today, +1, +2 relative to today)
  const stripDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = -1; i <= 2; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      days.push(d);
    }
    return days;
  }, [today]);

  const { data: holCur  } = useHolidays(selectedDate.getFullYear(),     showHolidays);
  const { data: holNext } = useHolidays(selectedDate.getFullYear() + 1, showHolidays);
  const holidayMap = useMemo<HolidayMap>(() => {
    if (!showHolidays) return new Map();
    const m: HolidayMap = new Map();
    for (const e of [...(holCur ?? []), ...(holNext ?? [])]) m.set(e.date, e);
    return m;
  }, [showHolidays, holCur, holNext]);

  const todayStr = toDateStr(today);
  const selStr   = toDateStr(selectedDate);

  // Month grid cells
  const monthCells = useMemo(
    () => buildCells(selectedDate.getFullYear(), selectedDate.getMonth()),
    [selectedDate],
  );

  const renderDayCard = (d: Date) => {
    const ds        = toDateStr(d);
    const isToday   = ds === todayStr;
    const isSel     = ds === selStr;
    const dayTasks  = getTasksForDate(tasks, d, new Set(), holidayMap);
    const dots      = taskDotColors(dayTasks);
    const overflow  = dayTasks.length > 9;
    const wInfo     = weather?.get(ds);
    const temp      = wInfo?.tempMax;
    const dow       = d.getDay();
    const hol       = holidayMap.get(ds);
    const isWeekend = dow === 0 || dow === 6;
    const isWorkday = hol?.type === 'workday';
    const numColor  = hol?.type === 'shortday' ? '#f59e0b'
                    : hol?.type === 'workday'  ? '#3b82f6'
                    : (isWeekend && !isWorkday) ? '#ef4444'
                    : undefined;
    const weekDayName = WEEKDAYS[(dow + 6) % 7];

    return (
      <button
        key={ds}
        type="button"
        className={[
          styles.dayCard,
          isToday ? styles.dayCardToday : '',
          isSel   ? styles.dayCardSel   : '',
        ].join(' ')}
        onClick={() => onSelect(d)}
      >
        <div className={styles.dayWeekday} style={numColor ? { color: numColor } : undefined}>
          {weekDayName}
        </div>
        <div className={styles.dayNum} style={numColor ? { color: numColor } : undefined}>
          {d.getDate()}
        </div>
        <div className={styles.dayMonth}>{MONTH_GEN[d.getMonth()]}</div>
        <div className={styles.dayDots}>
          {dots.map((c, i) => (
            <span key={i} className={styles.dayDot} style={{ background: c }} />
          ))}
          {overflow && <span className={styles.dayDotMore}>+</span>}
        </div>
        {temp != null && (
          <div className={styles.dayMetaTemp}>
            {temp > 0 ? '+' : ''}{temp}°
          </div>
        )}
      </button>
    );
  };

  return (
    <div className={styles.root}>
      {!expanded ? (
        // ── Default strip mode ──
        <div className={styles.strip}>
          {stripDays.map(d => renderDayCard(d))}
        </div>
      ) : (
        // ── Expanded month grid ──
        <div className={styles.monthBlock}>
          <div className={styles.monthTitle}>
            {MONTHS[selectedDate.getMonth()]} · {selectedDate.getFullYear()}
          </div>
          <div className={styles.monthWeekHead}>
            {WEEKDAYS.map((w, i) => (
              <span
                key={w}
                className={styles.monthWeekHeadCell}
                style={i >= 5 ? { color: '#ef4444' } : undefined}
              >{w}</span>
            ))}
          </div>
          <div className={styles.monthGrid}>
            {monthCells.map((day, i) => {
              if (!day) return <span key={i} className={styles.monthEmpty}/>;
              const d         = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
              const ds        = toDateStr(d);
              const isToday   = ds === todayStr;
              const isSel     = ds === selStr;
              const dayTasks  = getTasksForDate(tasks, d, new Set(), holidayMap);
              const dots      = taskDotColors(dayTasks);
              const overflow  = dayTasks.length > 9;
              const wInfo     = weather?.get(ds);
              const temp      = wInfo?.tempMax;
              const dow       = d.getDay();
              const hol       = holidayMap.get(ds);
              const isWeekend = dow === 0 || dow === 6;
              const isWorkday = hol?.type === 'workday';
              const numColor  = hol?.type === 'shortday' ? '#f59e0b'
                              : hol?.type === 'workday'  ? '#3b82f6'
                              : (isWeekend && !isWorkday) ? '#ef4444'
                              : undefined;
              return (
                <button
                  key={i}
                  type="button"
                  className={[
                    styles.monthCell,
                    isToday ? styles.monthCellToday : '',
                    isSel   ? styles.monthCellSel   : '',
                  ].join(' ')}
                  onClick={() => onSelect(d)}
                >
                  <span className={styles.monthCellNum} style={numColor ? { color: numColor } : undefined}>
                    {day}
                  </span>
                  <span className={styles.monthCellDots}>
                    {dots.map((c, di) => (
                      <span key={di} className={styles.monthCellDot} style={{ background: c }} />
                    ))}
                    {overflow && <span className={styles.monthCellDotMore}>+</span>}
                  </span>
                  {temp != null && (
                    <span className={styles.monthCellTemp}>{temp > 0 ? '+' : ''}{temp}°</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className={styles.timeRow}>
        <button
          type="button"
          className={styles.timeNow}
          onClick={onGoToToday}
          title="Вернуться к сегодня"
        >
          {String(now.getHours()).padStart(2,'0')}:{String(now.getMinutes()).padStart(2,'0')} {DAY_SHORT[now.getDay()]}
        </button>
        {currentWeather && (
          <span className={styles.headerTemp}>
            {currentWeather.temp > 0 ? '+' : ''}{currentWeather.temp}°
          </span>
        )}
        <button type="button" className={styles.toggleBtn} onClick={onToggleExpand} title={expanded ? 'Свернуть' : 'Развернуть месяц'}>
          {expanded ? '⌃' : '⌄'}
        </button>
      </div>
    </div>
  );
}
