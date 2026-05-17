'use client';

import { useEffect, useState } from 'react';
import { RepeatConfig } from '../../lib/tasks';
import styles from './RepeatConfigModal.module.scss';

const UNIT_LABELS: { value: RepeatConfig['unit']; label: string; labelMany: string }[] = [
  { value: 'day',   label: 'день',    labelMany: 'дней' },
  { value: 'week',  label: 'неделю',  labelMany: 'недель' },
  { value: 'month', label: 'месяц',   labelMany: 'месяцев' },
  { value: 'year',  label: 'год',     labelMany: 'лет' },
];

const WEEKDAYS = [
  { v: 1, s: 'Пн' }, { v: 2, s: 'Вт' }, { v: 3, s: 'Ср' },
  { v: 4, s: 'Чт' }, { v: 5, s: 'Пт' }, { v: 6, s: 'Сб' }, { v: 0, s: 'Вс' },
];

interface Props {
  initial?: RepeatConfig | null;
  selectedDate: string;
  onSave: (cfg: RepeatConfig) => void;
  onClose: () => void;
}

export function RepeatConfigModal({ initial, selectedDate, onSave, onClose }: Props) {
  const startDow = new Date(selectedDate + 'T00:00:00').getDay();

  const [every,        setEvery]        = useState(initial?.every ?? 1);
  const [unit,         setUnit]         = useState<RepeatConfig['unit']>(initial?.unit ?? 'week');
  const [weekdays,     setWeekdays]     = useState<number[]>(initial?.weekdays ?? (initial ? [] : [startDow]));
  const [skipWeekends, setSkipWeekends] = useState(initial?.skipWeekends ?? false);
  const [endMode,      setEndMode]      = useState<'never' | 'date' | 'after'>(
    initial?.endAfter ? 'after' : 'never'
  );
  const [endDate,   setEndDate]   = useState('');
  const [endAfter,  setEndAfter]  = useState(initial?.endAfter ?? 10);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const toggleWeekday = (d: number) =>
    setWeekdays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const handleSave = () => {
    const cfg: RepeatConfig = { every, unit };
    if (unit === 'week' && weekdays.length > 0) cfg.weekdays = weekdays;
    if (skipWeekends) cfg.skipWeekends = true;
    if (endMode === 'after' && endAfter > 0) cfg.endAfter = endAfter;
    onSave(cfg);
  };

  const everyLabel = (() => {
    const u = UNIT_LABELS.find(u => u.value === unit)!;
    return every === 1 ? u.label : u.labelMany;
  })();

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={styles.modal} onMouseDown={e => e.stopPropagation()}>

        <div className={styles.header}>
          <h3 className={styles.title}>Настройка повтора</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>

          {/* Every N units */}
          <div className={styles.field}>
            <label className={styles.label}>Повторять каждые</label>
            <div className={styles.everyRow}>
              <input
                className={styles.everyInput}
                type="number"
                min={1}
                max={365}
                value={every}
                onChange={e => setEvery(Math.max(1, parseInt(e.target.value) || 1))}
              />
              <div className={styles.unitBtns}>
                {UNIT_LABELS.map(u => (
                  <button
                    key={u.value}
                    type="button"
                    className={`${styles.unitBtn} ${unit === u.value ? styles.unitBtnActive : ''}`}
                    onClick={() => setUnit(u.value)}
                  >
                    {every === 1 ? u.label : u.labelMany}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Weekdays selection (for week unit) */}
          {unit === 'week' && (
            <div className={styles.field}>
              <label className={styles.label}>По дням</label>
              <div className={styles.wdRow}>
                {WEEKDAYS.map(({ v, s }) => (
                  <button
                    key={v}
                    type="button"
                    className={`${styles.wdBtn} ${weekdays.includes(v) ? styles.wdBtnActive : ''}`}
                    onClick={() => toggleWeekday(v)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Skip weekends */}
          {unit !== 'week' && (
            <div className={styles.field}>
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={skipWeekends}
                  onChange={e => setSkipWeekends(e.target.checked)}
                />
                Пропускать выходные (Сб, Вс)
              </label>
            </div>
          )}

          {/* End condition */}
          <div className={styles.field}>
            <label className={styles.label}>Завершение</label>
            <div className={styles.endOpts}>
              {(['never', 'after', 'date'] as const).map(m => (
                <label key={m} className={styles.endOpt}>
                  <input
                    type="radio"
                    name="endMode"
                    checked={endMode === m}
                    onChange={() => setEndMode(m)}
                  />
                  {m === 'never' && 'Никогда'}
                  {m === 'after' && 'После'}
                  {m === 'date'  && 'До даты'}
                </label>
              ))}
            </div>

            {endMode === 'after' && (
              <div className={styles.endAfterRow}>
                <input
                  className={styles.everyInput}
                  type="number"
                  min={1}
                  max={9999}
                  value={endAfter}
                  onChange={e => setEndAfter(Math.max(1, parseInt(e.target.value) || 1))}
                />
                <span className={styles.endAfterLabel}>повторений</span>
              </div>
            )}

            {endMode === 'date' && (
              <input
                className={styles.dateInput}
                type="date"
                value={endDate}
                min={selectedDate}
                onChange={e => setEndDate(e.target.value)}
              />
            )}
          </div>

        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>Отмена</button>
          <button type="button" className={styles.saveBtn} onClick={handleSave}>Сохранить</button>
        </div>
      </div>
    </div>
  );
}
