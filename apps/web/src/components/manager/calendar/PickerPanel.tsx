'use client';

import { useEffect, useRef, useState } from 'react';
import { MONTHS, MONTHS_SHORT, PickerType } from '../../../lib/calendarLayout';
import styles from './Calendar.module.scss';

// ── Floating picker (month or year) ──────────────────────────
interface PickerPanelProps {
  type: PickerType;
  currentMonth: number;
  currentYear: number;
  onPick: (month: number, year: number) => void;
  onClose: () => void;
}

export function PickerPanel({ type, currentMonth, currentYear, onPick, onClose }: PickerPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pageStart, setPageStart] = useState(currentYear - 6);

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

  if (type === 'month') {
    return (
      <div ref={ref} className={styles.picker}>
        <div className={styles.pickerTitle}>Выбор месяца</div>
        <div className={styles.pickerGrid}>
          {MONTHS.map((_m, i) => (
            <button
              key={i}
              className={[styles.pickerCell, i === currentMonth ? styles.pickerCellActive : ''].join(' ')}
              onClick={() => { onPick(i, currentYear); onClose(); }}
            >
              {MONTHS_SHORT[i]}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const years = Array.from({ length: 16 }, (_, i) => pageStart + i);

  return (
    <div ref={ref} className={styles.picker}>
      <div className={styles.pickerTitle}>
        <button className={styles.pickerNav} onClick={() => setPageStart(s => s - 16)}>‹</button>
        Выбор года
        <button className={styles.pickerNav} onClick={() => setPageStart(s => s + 16)}>›</button>
      </div>
      <div className={styles.pickerGrid}>
        {years.map(y => (
          <button
            key={y}
            className={[styles.pickerCell, y === currentYear ? styles.pickerCellActive : ''].join(' ')}
            onClick={() => { onPick(currentMonth, y); onClose(); }}
          >
            {y}
          </button>
        ))}
      </div>
    </div>
  );
}
