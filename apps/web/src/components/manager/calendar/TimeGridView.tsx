'use client';

import { useMemo } from 'react';
import { Task, toDateStr, getTasksForDate } from '../../../lib/tasks';
import { HolidayMap, getHolidayColor } from '../../../lib/holidays';
import {
  DAY_SHORT, HOURS, HOUR_H, ALLDAY_TASK_H, ALLDAY_GAP,
  pad, getISOWeek, taskColorStyle, taskBlockHeight, computeLayout,
} from '../../../lib/calendarLayout';
import { TYPE_CLS } from './taskTypeStyles';
import styles from './Calendar.module.scss';

// ── TimeGridView – shared by 'day' and 'week' ────────────────
interface TimeGridProps {
  days: Date[];
  tasks: Task[];
  selectedDate: Date;
  onSelect: (d: Date) => void;
  holidayMap?: HolidayMap;
  showWeekNum?: boolean;
}

export function TimeGridView({ days, tasks, selectedDate, onSelect, holidayMap, showWeekNum }: TimeGridProps) {
  const today  = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const todStr = toDateStr(today);
  const selStr = toDateStr(selectedDate);
  const now    = new Date();
  const nowTop = ((now.getHours() + now.getMinutes()/60) - 7) * HOUR_H;
  const showNow = now.getHours() >= 7 && now.getHours() < 23;

  // Считаем задачи дня один раз на колонку — переиспользуем и для общей
  // карты "весь день" слотов, и для разбивки timed/allDay в самих колонках
  const dayTasksPerDay = days.map(d => getTasksForDate(tasks, d, new Set(), holidayMap));
  const allDayPerDay = dayTasksPerDay.map(dt => dt.filter(t => !t.time));
  // Реально ли задача присутствует (отрисована) в колонке idx — учитывает удалённые
  // дни серии (getTasksForDate их пропускает), в отличие от taskActiveOn.
  const presentOn = (idx: number, id: string) =>
    idx >= 0 && idx < days.length && dayTasksPerDay[idx].some(x => x.id === id);
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
            const dayTasks = dayTasksPerDay[dayIdx];
            const timed    = dayTasks.filter(t => t.time);
            const allDay   = allDayPerDay[dayIdx];
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
                  // Рисуем непрерывным сегментом, разрывая полосу на удалённых днях
                  // (день удалён из серии → задачи там нет → сегмент прерывается).
                  if (presentOn(dayIdx - 1, t.id)) return null; // не начало сегмента
                  let segLen = 1;
                  while (presentOn(dayIdx + segLen, t.id)) segLen++;
                  const slot     = adSlot.get(t.id) ?? 0;
                  const range    = adRange.get(t.id);
                  const spanLen  = segLen;
                  // Квадратный правый край, только если сегмент упирается в край недели
                  // у многодневной задачи (вероятно, продолжается дальше).
                  const connR    = (dayIdx + segLen >= days.length) && !!range && range.max > range.min;
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
                  // Соединяем с соседним днём только если задача там реально есть
                  // (удалённые дни серии разрывают полосу).
                  const connL    = isStripe && presentOn(dayIdx - 1, t.id);
                  const connR    = isStripe && presentOn(dayIdx + 1, t.id);

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
