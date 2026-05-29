'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Task, toDateStr, getTasksForDate } from '../../lib/tasks';
import { useCalendarWeather, useCurrentWeather } from '../../lib/weather';
import { useAuthStore } from '../../store/authStore';
import { useHolidays, HolidayMap } from '../../lib/holidays';
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
  const { data: weather } = useCalendarWeather(selectedDate.getFullYear(), selectedDate.getMonth(), location);
  const { data: currentWeather } = useCurrentWeather(location);

  // Month picker state
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);

  // Широкая лента дней (±180 дней вокруг сегодня) — листается свободно,
  // нативной горизонтальной прокруткой с инерцией. Привязка к «сегодня»
  // стабильна, поэтому лента не пересобирается при смене выбранного дня.
  const STRIP_RANGE = 180;
  const stripDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = -STRIP_RANGE; i <= STRIP_RANGE; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      d.setHours(0, 0, 0, 0);
      days.push(d);
    }
    return days;
  }, [today]);

  // ── Прокрутка ленты ──────────────────────────────────────────
  const stripRef = useRef<HTMLDivElement>(null);
  const didInitScroll = useRef(false);

  // ── Swipe handling (только для развёрнутого месяца) ──────────
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const SWIPE_THRESHOLD = 40; // px

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchStart.current;
    touchStart.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    // Игнорируем вертикальный/слабый свайп
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    const dir = dx < 0 ? 1 : -1; // влево = вперёд
    const next = new Date(selectedDate);
    next.setMonth(next.getMonth() + dir);
    next.setHours(0, 0, 0, 0);
    onSelect(next);
  };

  // ── Month nav (expanded mode) ───────────────────────────────
  const shiftMonth = (dir: -1 | 1) => {
    const next = new Date(selectedDate);
    next.setMonth(next.getMonth() + dir);
    next.setHours(0, 0, 0, 0);
    onSelect(next);
  };

  const pickMonthYear = (m: number, y: number) => {
    const dim = new Date(y, m + 1, 0).getDate();
    const day = Math.min(selectedDate.getDate(), dim);
    const next = new Date(y, m, day);
    next.setHours(0, 0, 0, 0);
    onSelect(next);
    setMonthPickerOpen(false);
  };

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

  // Центрируем произвольный день в ленте.
  const scrollToDate = useCallback((ds: string, behavior: ScrollBehavior) => {
    const c = stripRef.current;
    if (!c) return;
    const el = c.querySelector<HTMLElement>(`[data-date="${ds}"]`);
    if (!el) return;
    const left = el.offsetLeft - (c.clientWidth - el.clientWidth) / 2;
    c.scrollTo({ left, behavior });
  }, []);

  // Центрируем выбранный день: при первом показе мгновенно, далее — плавно.
  useEffect(() => {
    if (expanded) return;
    scrollToDate(selStr, didInitScroll.current ? 'smooth' : 'auto');
    didInitScroll.current = true;
  }, [selStr, expanded, scrollToDate]);

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
    // Праздники и их переносы — красные, как выходные; сокращённый день — янтарный
    const numColor  = hol?.type === 'shortday' ? '#f59e0b'
                    : (isWeekend || hol?.type === 'holiday') ? '#ef4444'
                    : undefined;
    const weekDayName = WEEKDAYS[(dow + 6) % 7];

    return (
      <button
        key={ds}
        type="button"
        data-date={ds}
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

  // Карточки ленты мемоизируем, чтобы тик часов (каждые 30с) не пересчитывал
  // задачи/погоду для всех ±360 дней.
  const stripCards = useMemo(
    () => stripDays.map(d => renderDayCard(d)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stripDays, tasks, weather, holidayMap, selStr, todayStr],
  );

  return (
    <div className={styles.root}>
      {!expanded ? (
        // ── Лента дней ── свободная горизонтальная прокрутка с инерцией
        <div ref={stripRef} className={styles.strip}>
          {stripCards}
        </div>
      ) : (
        // ── Expanded month grid ── (swipe двигает месяц, есть кнопки и picker)
        <div
          className={styles.monthBlock}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className={styles.monthNav}>
            <button
              type="button"
              className={styles.monthNavBtn}
              onClick={() => shiftMonth(-1)}
              aria-label="Предыдущий месяц"
            >
              <ChevronLeft size={18} strokeWidth={2}/>
            </button>
            <button
              type="button"
              className={styles.monthTitleBtn}
              onClick={() => setMonthPickerOpen(o => !o)}
            >
              {MONTHS[selectedDate.getMonth()]} · {selectedDate.getFullYear()}
              <span className={styles.monthCaret}>▾</span>
            </button>
            <button
              type="button"
              className={styles.monthNavBtn}
              onClick={() => shiftMonth(1)}
              aria-label="Следующий месяц"
            >
              <ChevronRight size={18} strokeWidth={2}/>
            </button>
          </div>

          {monthPickerOpen && (
            <MonthYearPicker
              year={selectedDate.getFullYear()}
              month={selectedDate.getMonth()}
              onPick={pickMonthYear}
              onClose={() => setMonthPickerOpen(false)}
            />
          )}

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
              const numColor  = hol?.type === 'shortday' ? '#f59e0b'
                              : (isWeekend || hol?.type === 'holiday') ? '#ef4444'
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
          onClick={() => { onGoToToday(); scrollToDate(todayStr, 'smooth'); }}
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

// ── Month / Year picker (mobile only) ───────────────────────────
interface PickerProps {
  year: number;
  month: number;
  onPick: (month: number, year: number) => void;
  onClose: () => void;
}

function MonthYearPicker({ year, month, onPick, onClose }: PickerProps) {
  const [pageYear, setPageYear] = useState(year);
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

  const monthsShort = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];

  return (
    <div ref={ref} className={styles.pickerPanel}>
      <div className={styles.pickerYearRow}>
        <button type="button" className={styles.pickerYearBtn}
          onClick={() => setPageYear(y => y - 1)} aria-label="Предыдущий год">‹</button>
        <span className={styles.pickerYearLabel}>{pageYear}</span>
        <button type="button" className={styles.pickerYearBtn}
          onClick={() => setPageYear(y => y + 1)} aria-label="Следующий год">›</button>
      </div>
      <div className={styles.pickerMonthsGrid}>
        {monthsShort.map((m, i) => {
          const isActive = i === month && pageYear === year;
          return (
            <button
              key={m}
              type="button"
              className={[styles.pickerMonthCell, isActive ? styles.pickerMonthCellActive : ''].join(' ')}
              onClick={() => onPick(i, pageYear)}
            >
              {m}
            </button>
          );
        })}
      </div>
    </div>
  );
}
