'use client';

import { useState } from 'react';
import { Task, toDateStr, getTasksForDate } from '../../../lib/tasks';
import { useWeatherShownLock } from '../../../lib/weatherLock';
import { getHolidayColor, getHolidayName } from '../../../lib/holidays';
import { Icon, hasIcon } from '../../../lib/icons';
import { useCalendarWeather } from '../../../lib/weather';
import { useAuthStore } from '../../../store/authStore';
import { useHolidayMap } from '../../../hooks/useHolidayMap';
import { WEEKDAYS, MONTHS, PickerType, buildCells } from '../../../lib/calendarLayout';
import { PickerPanel } from './PickerPanel';
import { ChartView } from './ChartView';
import styles from './Calendar.module.scss';

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

  const holidayMap = useHolidayMap(viewYear);

  const [prevSelectedDate, setPrevSelectedDate] = useState(selectedDate);
  if (selectedDate !== prevSelectedDate) {
    setPrevSelectedDate(selectedDate);
    setViewYear(selectedDate.getFullYear());
    setViewMonth(selectedDate.getMonth());
  }

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
        {tagItems.map(tag => (
          hasIcon(tag.icon)
            ? <Icon key={tag.id} name={tag.icon} size={9} strokeWidth={2.5} color={tag.color} />
            : <span key={tag.id} className={styles.dot} style={{ background: tag.color }} />
        ))}
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
