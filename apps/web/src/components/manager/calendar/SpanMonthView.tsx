'use client';

import { useMemo } from 'react';
import { Task, toDateStr } from '../../../lib/tasks';
import { HolidayMap } from '../../../lib/holidays';
import {
  WEEKDAYS, MONTHS, SPAN_SLOT_H, SPAN_HEAD_H, SPAN_MAX_SLOTS,
  buildWeeks, computeWeekSpans,
} from '../../../lib/calendarLayout';
import { TYPE_CLS } from './taskTypeStyles';
import styles from './Calendar.module.scss';

// ── SpanMonthView ─────────────────────────────────────────────
interface SpanMonthViewProps {
  year: number; month: number;
  tasks: Task[]; selectedDate: Date; onSelect: (d: Date) => void;
  holidayMap?: HolidayMap;
  showMonthLabel?: boolean;
}

export function SpanMonthView({ year, month, tasks, selectedDate, onSelect, holidayMap, showMonthLabel }: SpanMonthViewProps) {
  const today  = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const todStr = toDateStr(today);
  const selStr = toDateStr(selectedDate);
  const weeks  = useMemo(() => buildWeeks(year, month), [year, month]);
  const weekHeight = SPAN_HEAD_H + SPAN_MAX_SLOTS * SPAN_SLOT_H + 6;

  return (
    <div className={styles.spanMonth}>
      {showMonthLabel && <div className={styles.spanMonthTitle}>{MONTHS[month]}</div>}
      <div className={styles.spanMonthHead}>
        {WEEKDAYS.map(d => <span key={d} className={styles.spanMonthWd}>{d}</span>)}
      </div>
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
