'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Task, TaskRepeat, TaskType, toDateStr } from '../../lib/tasks';
import styles from './TaskFormModal.module.scss';

// ── Draft preservation (10 min) ───────────────────────────────
const DRAFT_TTL = 10 * 60 * 1000;

interface Draft {
  title: string; description: string; time: string;
  repeat: TaskRepeat; hasEnd: boolean; repeatUntil: string;
  type: TaskType; savedAt: number;
}

function draftKey(dateStr: string) { return `wt_draft_${dateStr}`; }

function loadDraft(dateStr: string): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(dateStr));
    if (!raw) return null;
    const d: Draft = JSON.parse(raw);
    if (Date.now() - d.savedAt > DRAFT_TTL) {
      localStorage.removeItem(draftKey(dateStr)); return null;
    }
    return d;
  } catch { return null; }
}

function saveDraft(dateStr: string, d: Draft) {
  localStorage.setItem(draftKey(dateStr), JSON.stringify(d));
}

function clearDraft(dateStr: string) {
  localStorage.removeItem(draftKey(dateStr));
}

const REPEAT_LABELS: Record<TaskRepeat, string> = {
  none:    'Без повтора',
  daily:   'Каждый день',
  weekly:  'Каждую неделю',
  monthly: 'Каждый месяц',
  yearly:  'Каждый год',
};

const TYPE_LABELS: Record<TaskType, string> = {
  normal:    'Обычная',
  mandatory: 'Обязательная',
  event:     'Эвент',
};

interface Props {
  task?: Task;      // provided → edit mode; absent → create mode
  date: Date;       // initial date for create; ignored in edit mode
  isAdmin: boolean;
  onSave: (data: Omit<Task, 'id' | 'status'>) => void;
  onClose: () => void;
}

export function TaskFormModal({ task, date, isAdmin, onSave, onClose }: Props) {
  const isEdit        = !!task;
  const initialDate   = useMemo(() => toDateStr(date), []); // frozen at mount
  const draft         = useMemo(() => (!isEdit ? loadDraft(initialDate) : null), []);

  const [title,       setTitle]       = useState(task?.title       ?? draft?.title       ?? '');
  const [description, setDesc]        = useState(task?.description ?? draft?.description ?? '');
  const [formDate,    setFormDate]    = useState(task?.date        ?? initialDate);
  const [time,        setTime]        = useState(task?.time        ?? draft?.time        ?? '');
  const [repeat,      setRepeat]      = useState<TaskRepeat>(task?.repeat ?? draft?.repeat ?? 'none');
  const [hasEnd,      setHasEnd]      = useState(task ? !!task.repeatUntil : (draft?.hasEnd ?? false));
  const [repeatUntil, setRepeatUntil] = useState(task?.repeatUntil ?? draft?.repeatUntil ?? '');
  const [type,        setType]        = useState<TaskType>(task?.type ?? draft?.type ?? 'normal');

  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  // Auto-save draft every time fields change (create mode only)
  useEffect(() => {
    if (isEdit) return;
    if (!title.trim()) return;
    saveDraft(initialDate, { title, description, time, repeat, hasEnd, repeatUntil, type, savedAt: Date.now() });
  }, [title, description, time, repeat, hasEnd, repeatUntil, type, isEdit, initialDate]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const availableTypes: TaskType[] = isAdmin
    ? ['normal', 'mandatory', 'event']
    : ['normal', 'mandatory'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    if (!isEdit) clearDraft(initialDate);
    onSave({
      title:       trimmed,
      description: description.trim() || undefined,
      date:        formDate,
      time:        time || undefined,
      repeat,
      repeatUntil: (repeat !== 'none' && hasEnd && repeatUntil) ? repeatUntil : undefined,
      type,
    });
    onClose();
  };

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={styles.modal} onMouseDown={e => e.stopPropagation()}>

        <div className={styles.head}>
          <h2 className={styles.title}>{isEdit ? 'Изменить задачу' : 'Новая задача'}</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">✕</button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>

          {/* Title */}
          <div className={styles.field}>
            <label className={styles.label}>Название</label>
            <input
              ref={titleRef}
              className={styles.input}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Что нужно сделать?"
              required
            />
          </div>

          {/* Description */}
          <div className={styles.field}>
            <label className={styles.label}>
              Описание <span className={styles.optional}>(необязательно)</span>
            </label>
            <textarea
              className={styles.textarea}
              value={description}
              onChange={e => setDesc(e.target.value)}
              placeholder="Подробности..."
              rows={3}
            />
          </div>

          {/* Date + Time */}
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Дата</label>
              <input
                className={styles.input}
                type="date"
                value={formDate}
                onChange={e => setFormDate(e.target.value)}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>
                Время <span className={styles.optional}>(необязательно)</span>
              </label>
              <input
                className={styles.input}
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
              />
            </div>
          </div>

          {/* Repeat */}
          <div className={styles.field}>
            <label className={styles.label}>Повтор</label>
            <select
              className={styles.select}
              value={repeat}
              onChange={e => setRepeat(e.target.value as TaskRepeat)}
            >
              {(Object.keys(REPEAT_LABELS) as TaskRepeat[]).map(r => (
                <option key={r} value={r}>{REPEAT_LABELS[r]}</option>
              ))}
            </select>
          </div>

          {/* Repeat until */}
          {repeat !== 'none' && (
            <div className={styles.field}>
              <label className={styles.label}>Повторять до</label>
              <div className={styles.repeatUntilRow}>
                <label className={styles.checkLabel}>
                  <input
                    type="checkbox"
                    checked={hasEnd}
                    onChange={e => setHasEnd(e.target.checked)}
                  />
                  Ограничить по дате
                </label>
                {hasEnd && (
                  <input
                    className={styles.input}
                    type="date"
                    value={repeatUntil}
                    min={formDate}
                    onChange={e => setRepeatUntil(e.target.value)}
                  />
                )}
              </div>
            </div>
          )}

          {/* Type */}
          <div className={styles.field}>
            <label className={styles.label}>Тип</label>
            <select
              className={styles.select}
              value={type}
              onChange={e => setType(e.target.value as TaskType)}
            >
              {availableTypes.map(t => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Отмена</button>
            <button type="submit" className={styles.submitBtn} disabled={!title.trim()}>
              {isEdit ? 'Сохранить' : 'Создать'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
