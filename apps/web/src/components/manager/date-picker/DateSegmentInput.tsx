'use client';

import { RefObject } from 'react';
import { fmtDisplay } from './logic';
import styles from './DatePickerPopup.module.scss';

type Seg = 'day' | 'mon' | 'year';

interface DateSegmentInputProps {
  which: 'start' | 'end';
  fixed?: boolean;
  value: string;
  isOpen: boolean;
  editDay: string;
  editMon: string;
  editYear: string;
  dayRef: RefObject<HTMLInputElement | null>;
  monRef: RefObject<HTMLInputElement | null>;
  yearRef: RefObject<HTMLInputElement | null>;
  onOpen: (which: 'start' | 'end') => void;
  onDayChange: (raw: string) => void;
  onMonChange: (raw: string) => void;
  onYearChange: (raw: string) => void;
  onSegKeyDown: (seg: Seg, e: React.KeyboardEvent<HTMLInputElement>) => void;
}

/** Поле даты: либо редактор из трёх сегментов (ДД.ММ.ГГГГ), либо pill-кнопка с отображаемым значением. */
export function DateSegmentInput({
  which, fixed = false, value, isOpen, editDay, editMon, editYear,
  dayRef, monRef, yearRef, onOpen, onDayChange, onMonChange, onYearChange, onSegKeyDown,
}: DateSegmentInputProps) {
  const fixCls = fixed ? styles.datePillFixed : '';

  if (isOpen) {
    return (
      <div key={`edit-${which}`} className={[styles.datePillWrap, fixCls].join(' ')}>
        <input
          ref={dayRef}
          className={styles.segInput}
          value={editDay}
          placeholder="ДД"
          inputMode="numeric"
          autoComplete="off"
          onChange={e => onDayChange(e.target.value)}
          onKeyDown={e => onSegKeyDown('day', e)}
          onFocus={e => e.target.select()}
        />
        <span className={styles.segSep}>.</span>
        <input
          ref={monRef}
          className={styles.segInput}
          value={editMon}
          placeholder="ММ"
          inputMode="numeric"
          autoComplete="off"
          onChange={e => onMonChange(e.target.value)}
          onKeyDown={e => onSegKeyDown('mon', e)}
          onFocus={e => e.target.select()}
        />
        <span className={styles.segSep}>.</span>
        <input
          ref={yearRef}
          className={[styles.segInput, styles.segInputYear].join(' ')}
          value={editYear}
          placeholder="ГГГГ"
          inputMode="numeric"
          autoComplete="off"
          onChange={e => onYearChange(e.target.value)}
          onKeyDown={e => onSegKeyDown('year', e)}
          onFocus={e => e.target.select()}
        />
      </div>
    );
  }

  return (
    <button
      key={`pill-${which}`}
      type="button"
      className={[styles.datePill, fixCls].join(' ')}
      onClick={() => onOpen(which)}
    >
      {value ? fmtDisplay(value) : <span className={styles.datePillPlaceholder}>ДД.ММ.ГГГГ</span>}
    </button>
  );
}
