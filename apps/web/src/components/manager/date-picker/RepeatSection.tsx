'use client';

import { TaskRepeat, toDateStr } from '../../../lib/tasks';
import { fromStr, addDays, RepeatOption } from './logic';
import styles from './DatePickerPopup.module.scss';

interface RepeatSectionProps {
  repeat: TaskRepeat;
  repeatLabel: string;
  repeatOpts: RepeatOption[];
  repeatOpen: boolean;
  setRepeatOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  onSelect: (value: TaskRepeat) => void;
  onClear: (e: React.MouseEvent) => void;
  onOpenRepeatConfig: () => void;
  hasRepeatUntil: boolean;
  onChangeHasRepeatUntil: (v: boolean) => void;
  repeatUntil: string;
  onChangeRepeatUntil: (d: string) => void;
  multiDay: boolean;
  date: string;
  endDate: string;
}

export function RepeatSection({
  repeat, repeatLabel, repeatOpts, repeatOpen, setRepeatOpen, onSelect, onClear,
  onOpenRepeatConfig, hasRepeatUntil, onChangeHasRepeatUntil, repeatUntil, onChangeRepeatUntil,
  multiDay, date, endDate,
}: RepeatSectionProps) {
  return (
    <div className={styles.repeatSection}>
      <div className={styles.repeatRow}>
        <button type="button"
          className={`${styles.repeatToggle} ${repeat!=='none'?styles.repeatToggleActive:''}`}
          onClick={() => setRepeatOpen(v=>!v)}>
          {repeatLabel}
        </button>
        {repeat !== 'none' && <button type="button" className={styles.repeatClear} onClick={onClear}>✕</button>}
      </div>
      {repeatOpen && (
        <div className={styles.repeatDropdown}>
          {repeatOpts.map(opt => (
            <button key={opt.value} type="button"
              className={`${styles.repeatItem} ${repeat===opt.value?styles.repeatItemActive:''}`}
              onClick={() => onSelect(opt.value)}>
              {opt.accent != null
                ? <>{opt.prefix}<span className={styles.repeatAccent}>{opt.accent}</span></>
                : opt.prefix}
            </button>
          ))}
          <div className={styles.repeatDivider}/>
          <button type="button" className={styles.repeatConfigure}
            onClick={() => { setRepeatOpen(false); onOpenRepeatConfig(); }}>
            + Настроить
          </button>
        </div>
      )}
      {repeat !== 'none' && (
        <div className={styles.repeatUntilRow}>
          <label className={styles.repeatUntilLabel}>
            <input type="checkbox" checked={hasRepeatUntil}
              onChange={e => { onChangeHasRepeatUntil(e.target.checked); if (!e.target.checked) onChangeRepeatUntil(''); }}/>
            Повторять до
          </label>
          {hasRepeatUntil && (() => {
            // Минимум: день после даты начала (single) или после даты конца (multi-day)
            const baseStr = multiDay && endDate ? endDate : date;
            const minUntil = toDateStr(addDays(fromStr(baseStr), 1));
            return (
              <input className={styles.repeatUntilInput} type="date" value={repeatUntil} min={minUntil}
                onChange={e => onChangeRepeatUntil(e.target.value)}/>
            );
          })()}
        </div>
      )}
    </div>
  );
}
