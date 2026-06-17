'use client';

import { useState, type RefObject } from 'react';
import { X } from 'lucide-react';
import type { ReminderRule } from '../../../lib/tasks';
import { MiniCalendar } from '../repeat-config/MiniCalendar';
import styles from './TaskFormModal.module.scss';

const uid = () => Math.random().toString(36).slice(2, 10);

interface Pos { top: number; left: number }

interface Preset {
  key: string;
  label: string;
  type: 'at_time' | 'before';
  offsetMinutes: number;
  /** требует у задачи `time` */
  needsTime?: boolean;
}

const PRESETS: Preset[] = [
  { key: 'at_time',  label: 'В момент задачи', type: 'at_time', offsetMinutes: 0,     needsTime: true },
  { key: 'before5',  label: 'За 5 минут',      type: 'before',  offsetMinutes: 5,     needsTime: true },
  { key: 'before1d', label: 'За день',         type: 'before',  offsetMinutes: 1440 },
  { key: 'before1w', label: 'За неделю',       type: 'before',  offsetMinutes: 10080 },
];

/** Человекочитаемая подпись правила напоминания. */
export function reminderLabel(rule: ReminderRule): string {
  if (rule.type === 'at_time') return 'В момент задачи';
  if (rule.type === 'before') {
    switch (rule.offsetMinutes) {
      case 5:     return 'За 5 минут';
      case 1440:  return 'За день';
      case 10080: return 'За неделю';
      default:    return `За ${rule.offsetMinutes ?? 0} мин`;
    }
  }
  // custom
  const at = rule.at ?? '';
  const dateStr = at.slice(0, 10);
  const d = new Date(dateStr + 'T00:00:00');
  const datePart = d.toLocaleDateString('ru', { day: 'numeric', month: 'long' });
  const timePart = at.includes('T') ? `, ${at.slice(11, 16)}` : '';
  return `${datePart}${timePart}`;
}

const matchesPreset = (r: ReminderRule, p: Preset) =>
  r.type === p.type && (r.type === 'at_time' || r.offsetMinutes === p.offsetMinutes);

interface Props {
  reminders: ReminderRule[];
  onChange: (next: ReminderRule[]) => void;
  hasTime: boolean;
  /** минимальная дата для «произвольно» (обычно сегодня) */
  minDate: string;
  open: boolean;
  pos: Pos | null;
  dropRef: RefObject<HTMLDivElement | null>;
  /** вызывается при добавлении самого первого правила (запрос разрешения на push) */
  onFirstAdd?: () => void;
}

export function ReminderDropdown({ reminders, onChange, hasTime, minDate, open, pos, dropRef, onFirstAdd }: Props) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customDate, setCustomDate] = useState(minDate);
  const [customTime, setCustomTime] = useState('');

  if (!open || !pos) return null;

  const customRules = reminders.filter(r => r.type === 'custom');

  const add = (rule: ReminderRule) => {
    if (reminders.length === 0) onFirstAdd?.();
    onChange([...reminders, rule]);
  };

  const togglePreset = (p: Preset) => {
    const existing = reminders.find(r => matchesPreset(r, p));
    if (existing) {
      onChange(reminders.filter(r => r !== existing));
    } else {
      add({ id: uid(), type: p.type, offsetMinutes: p.offsetMinutes });
    }
  };

  const addCustom = () => {
    const at = customTime ? `${customDate}T${customTime}` : customDate;
    add({ id: uid(), type: 'custom', at });
    setCustomOpen(false);
    setCustomTime('');
  };

  const removeRule = (id: string) => onChange(reminders.filter(r => r.id !== id));

  return (
    <div
      ref={dropRef}
      className={styles.reminderDrop}
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={e => e.stopPropagation()}
    >
      {PRESETS.map(p => {
        if (p.needsTime && !hasTime) return null;
        const active = reminders.some(r => matchesPreset(r, p));
        return (
          <button
            key={p.key}
            type="button"
            className={[styles.metaDropItem, active ? styles.metaDropItemActive : ''].join(' ')}
            onClick={() => togglePreset(p)}
          >
            <span className={active ? styles.reminderBox : styles.reminderBoxEmpty}>
              {active && '✓'}
            </span>
            {p.label}
          </button>
        );
      })}

      <div className={styles.reminderDivider} />

      {/* Произвольная дата/время */}
      {customRules.map(r => (
        <div key={r.id} className={styles.reminderRuleRow}>
          <span className={styles.reminderRuleLabel}>{reminderLabel(r)}</span>
          <button type="button" className={styles.reminderRuleDel} onClick={() => removeRule(r.id)} aria-label="Удалить">
            <X size={13} />
          </button>
        </div>
      ))}

      {!customOpen ? (
        <button type="button" className={styles.reminderCustomToggle} onClick={() => setCustomOpen(true)}>
          + Произвольно…
        </button>
      ) : (
        <div className={styles.reminderCustomPanel}>
          <MiniCalendar value={customDate} minDate={minDate} onChange={setCustomDate} />
          <div className={styles.reminderTimeRow}>
            <span className={styles.reminderTimeLabel}>Время</span>
            <input
              type="time"
              className={styles.reminderTimeInput}
              value={customTime}
              onChange={e => setCustomTime(e.target.value)}
            />
          </div>
          <div className={styles.reminderCustomActions}>
            <button type="button" className={styles.reminderCancelBtn} onClick={() => setCustomOpen(false)}>Отмена</button>
            <button type="button" className={styles.reminderAddBtn} onClick={addCustom}>Добавить</button>
          </div>
        </div>
      )}
    </div>
  );
}
