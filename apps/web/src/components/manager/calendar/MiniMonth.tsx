'use client';

import { useMemo } from 'react';
import { Task, toDateStr, getTasksForDate } from '../../../lib/tasks';
import { HolidayMap, getHolidayColor } from '../../../lib/holidays';
import { WEEKDAYS, MONTHS, MONTHS_SHORT, buildCells } from '../../../lib/calendarLayout';
import styles from './Calendar.module.scss';

// ── Mini month (month/quarter/year chart views) ───────────────
interface MiniMonthProps {
  year: number; month: number;
  tasks: Task[]; selectedDate: Date; onSelect: (d: Date) => void;
  compact?: boolean;
  holidayMap?: HolidayMap;
}

export function MiniMonth({ year, month, tasks, selectedDate, onSelect, compact, holidayMap }: MiniMonthProps) {
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
