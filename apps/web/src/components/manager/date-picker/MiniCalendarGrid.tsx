'use client';

import { Dispatch, SetStateAction } from 'react';
import { toDateStr } from '../../../lib/tasks';
import { HolidayMap, getHolidayColor } from '../../../lib/holidays';
import { MONTH_NAME, getISOWeek } from './logic';
import styles from './DatePickerPopup.module.scss';

const WEEKDAY_LABELS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

interface HoverRange { from: string; to: string }

interface MiniCalendarGridProps {
  calYear: number;
  calMonth: number;
  setCalYear: Dispatch<SetStateAction<number>>;
  setCalMonth: Dispatch<SetStateAction<number>>;
  now: Date;
  grid: (Date | null)[][];
  holidayMap: HolidayMap;
  multiDay: boolean;
  calTarget: 'start' | 'end';
  date: string;
  selStr: string;
  endStr: string;
  todayStr: string;
  hoverDate: string | null;
  setHoverDate: (d: string | null) => void;
  previewDate: string | null;
  onDayClick: (d: Date) => void;
}

export function MiniCalendarGrid({
  calYear, calMonth, setCalYear, setCalMonth, now, grid, holidayMap,
  multiDay, calTarget, date, selStr, endStr, todayStr,
  hoverDate, setHoverDate, previewDate, onDayClick,
}: MiniCalendarGridProps) {
  const prevMonth = () => { if (calMonth===0){setCalYear(y=>y-1);setCalMonth(11);}else setCalMonth(m=>m-1); };
  const nextMonth = () => { if (calMonth===11){setCalYear(y=>y+1);setCalMonth(0);}else setCalMonth(m=>m+1); };

  const getHoverRange = (): HoverRange | null => {
    if (!multiDay||!hoverDate) return null;
    if (calTarget==='end'   && hoverDate>selStr) return { from: selStr, to: hoverDate };
    if (calTarget==='start' && endStr && hoverDate<endStr) return { from: hoverDate, to: endStr };
    return null;
  };

  return (
    <div className={styles.calBody}>
      <div className={styles.calHead}>
        <button type="button" className={styles.calNav} onClick={prevMonth}>‹</button>
        <button type="button" className={styles.calTitleBtn}
          onClick={() => { setCalYear(now.getFullYear()); setCalMonth(now.getMonth()); }}
          title="К текущему месяцу">
          {MONTH_NAME[calMonth]} {calYear}
        </button>
        <button type="button" className={styles.calNav} onClick={nextMonth}>›</button>
      </div>
      <div className={styles.calWds}>
        <span className={styles.calWdWeek}>Н</span>
        {WEEKDAY_LABELS.map(d=>(
          <span key={d} className={styles.calWd}>{d}</span>
        ))}
      </div>
      {grid.map((row, ri) => {
        const hoverRange = getHoverRange();
        const firstCell  = row.find(c => c !== null);
        const weekNum    = firstCell ? getISOWeek(firstCell) : null;
        return (
          <div key={ri} className={styles.calRow}>
            <span className={styles.weekNum}>{weekNum}</span>
            {row.map((cell, ci) => {
              if (!cell) return <span key={ci} className={styles.calEmpty}/>;
              const s = toDateStr(cell);
              const hol = holidayMap.get(s);
              const holColor = hol ? getHolidayColor(hol.type) : undefined;
              const cellDow       = cell.getDay();
              const cellIsWeekend = cellDow === 0 || cellDow === 6;
              const cellIsWorkday = hol?.type === 'workday';
              const cellNumColor  = holColor && !cellIsWorkday ? holColor
                                  : cellIsWeekend && !cellIsWorkday ? '#ef4444'
                                  : undefined;
              const isHoverSel     = multiDay && hoverDate===s && hoverRange!==null;
              const isHoverBetween = multiDay && hoverRange!==null && s>hoverRange.from && s<hoverRange.to;
              const isDisabled     = calTarget === 'end' && !!date && s < date;
              const isPreviewed    = !isDisabled && previewDate===s && s!==selStr && s!==endStr;
              return (
                <button key={ci} type="button"
                  disabled={isDisabled}
                  className={[
                    styles.calCell,
                    s===selStr                     ? styles.calSel         : '',
                    s===endStr                     ? styles.calEnd         : '',
                    multiDay&&s>selStr&&s<endStr   ? styles.calBetween     : '',
                    s===todayStr                   ? styles.calToday       : '',
                    isHoverSel                     ? styles.calHoverSel    : '',
                    isHoverBetween                 ? styles.calHoverBetween: '',
                    isPreviewed                    ? styles.calPreviewed   : '',
                  ].join(' ')}
                  onClick={() => onDayClick(cell)}
                  onMouseEnter={() => multiDay && !isDisabled && setHoverDate(s)}
                  onMouseLeave={() => multiDay && setHoverDate(null)}
                  title={hol?.name||undefined}
                >
                  <span style={cellNumColor ? { color: cellNumColor } : undefined}>
                    {cell.getDate()}
                  </span>
                  {hol && <span className={styles.calHolDot} style={{background:holColor}}/>}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
