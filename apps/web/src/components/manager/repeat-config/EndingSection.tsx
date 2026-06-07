'use client';

import { MiniCalendar } from './MiniCalendar';
import type { UseRepeatConfigResult } from '../../../hooks/useRepeatConfig';
import styles from './RepeatConfigModal.module.scss';

interface Props {
  r: UseRepeatConfigResult;
}

export function EndingSection({ r }: Props) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>Завершение</div>
      <div className={styles.endOpts}>
        <label className={styles.radioRow}>
          <input type="radio" name="endMode" checked={r.endMode === 'never'} onChange={() => r.setEndMode('never')} />
          Никогда
        </label>
        <label className={styles.radioRow}>
          <input type="radio" name="endMode" checked={r.endMode === 'after'} onChange={() => r.setEndMode('after')} />
          После
          <input
            className={styles.endAfterInput}
            type="number"
            min={1}
            max={9999}
            value={r.endAfter}
            disabled={r.endMode !== 'after'}
            onChange={e => r.setEndAfter(Math.max(1, parseInt(e.target.value) || 1))}
            onClick={() => r.setEndMode('after')}
          />
          повторений
        </label>
        <label className={styles.radioRow}>
          <input type="radio" name="endMode" checked={r.endMode === 'date'} onChange={() => r.setEndMode('date')} />
          До даты
        </label>
        {r.endMode === 'date' && (
          <MiniCalendar
            value={r.endDate}
            minDate={r.minRepeatUntil}
            onChange={r.setEndDate}
          />
        )}
      </div>
    </div>
  );
}
