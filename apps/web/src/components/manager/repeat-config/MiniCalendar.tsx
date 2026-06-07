'use client';

import { useState } from 'react';
import { toDateStr } from '../../../lib/tasks';
import { RU_MONTHS, RU_WD_SHORT, buildMonthGrid } from '../../../lib/repeatConfig';
import styles from './RepeatConfigModal.module.scss';

interface MiniCalProps {
  value: string;
  minDate: string;
  onChange: (iso: string) => void;
}

export function MiniCalendar({ value, minDate, onChange }: MiniCalProps) {
  const seed = value || minDate;
  const seedDate = new Date(seed + 'T00:00:00');
  const minD     = new Date(minDate + 'T00:00:00');

  const [viewYear,  setViewYear]  = useState(seedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(seedDate.getMonth());

  const cells = buildMonthGrid(viewYear, viewMonth);
  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  return (
    <div className={styles.miniCal}>
      <div className={styles.miniCalHead}>
        <button type="button" className={styles.miniCalNav} onClick={prevMonth}>‹</button>
        <span className={styles.miniCalTitle}>{RU_MONTHS[viewMonth]} {viewYear}</span>
        <button type="button" className={styles.miniCalNav} onClick={nextMonth}>›</button>
      </div>
      <div className={styles.miniCalWds}>
        {RU_WD_SHORT.map(w => <span key={w} className={styles.miniCalWd}>{w}</span>)}
      </div>
      <div className={styles.miniCalGrid}>
        {cells.map((d, i) => {
          if (!d) return <span key={i} className={styles.miniCalEmpty} />;
          const iso = toDateStr(d);
          const isDisabled = d < minD;
          const isSelected = iso === value;
          return (
            <button
              key={i}
              type="button"
              disabled={isDisabled}
              className={`${styles.miniCalCell} ${isSelected ? styles.miniCalCellSelected : ''}`}
              onClick={() => onChange(iso)}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
