'use client';

import { useMemo } from 'react';
import { Task, toDateStr } from '../../../lib/tasks';
import { HolidayMap } from '../../../lib/holidays';
import {
  WEEKDAYS, MONTHS_SHORT, YR_COLS, YR_SLOT_H, YR_HEAD_H, YR_MAX_SL,
  taskColorStyle, computeMonthSpans,
} from '../../../lib/calendarLayout';
import { TYPE_CLS } from './taskTypeStyles';
import styles from './Calendar.module.scss';

// ── YearView ──────────────────────────────────────────────────
// Weekday-aligned year grid:
//   header: "Месяц | Пн Вт Ср Чт Пт Сб Вс Пн Вт …"  (37 day columns)
//   each month row places its days at columns offset by the weekday of the 1st

interface YearViewProps {
  year: number; tasks: Task[]; selectedDate: Date; onSelect: (d: Date) => void; holidayMap?: HolidayMap;
}

export function YearView({ year, tasks, selectedDate, onSelect, holidayMap }: YearViewProps) {
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

        const { spans: vis, overflow: ovfl } = computeMonthSpans(year, mi, tasks, holidayMap);

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
