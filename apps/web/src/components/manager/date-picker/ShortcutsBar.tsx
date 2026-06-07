'use client';

import { toDateStr } from '../../../lib/tasks';
import { scRight } from './logic';
import styles from './DatePickerPopup.module.scss';

interface Shortcut {
  label: string;
  d: Date;
}

interface ShortcutsBarProps {
  items: Shortcut[];
  now: Date;
  date: string;
  onSelect: (d: Date) => void;
}

export function ShortcutsBar({ items, now, date, onSelect }: ShortcutsBarProps) {
  return (
    <div className={styles.shortcuts}>
      {items.map(s => (
        <button key={s.label} type="button"
          className={`${styles.shortcut} ${toDateStr(s.d)===date?styles.shortcutActive:''}`}
          onClick={() => onSelect(s.d)}
        >
          <span className={styles.scLabel}>{s.label}</span>
          <span className={styles.scRight}>{scRight(s.d, now)}</span>
        </button>
      ))}
    </div>
  );
}
