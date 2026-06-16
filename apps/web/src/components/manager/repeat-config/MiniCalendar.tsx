'use client';

import { useState } from 'react';
import { toDateStr } from '../../../lib/tasks';
import { RU_MONTHS, RU_WD_SHORT, buildMonthGrid } from '../../../lib/repeatConfig';
import styles from './RepeatConfigModal.module.scss';

interface MiniCalProps {
  value: string;
  /** Минимальная выбираемая дата. Опционально — без неё ничего не блокируется. */
  minDate?: string;
  onChange: (iso: string) => void;
  /** Доп. класс на корень (для отступов в месте использования). */
  className?: string;
}

export function MiniCalendar({ value, minDate, onChange, className }: MiniCalProps) {
  const seedRaw  = value || minDate || '';
  const parsed   = seedRaw ? new Date(seedRaw + 'T00:00:00') : new Date();
  const seedDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const minD     = minDate ? new Date(minDate + 'T00:00:00') : null;

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
    <div className={[styles.miniCal, className].filter(Boolean).join(' ')}>
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
          const isDisabled = minD ? d < minD : false;
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
