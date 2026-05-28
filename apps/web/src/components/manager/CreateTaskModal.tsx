'use client';

import { useEffect, useRef, useState } from 'react';
import { Task, TaskRepeat, TaskType, toDateStr } from '../../lib/tasks';
import { Modal, Button, Input } from '../../components/ui';
import styles from './CreateTaskModal.module.scss';

const REPEAT_LABELS: Record<TaskRepeat, string> = {
  none:     'Без повтора',
  daily:    'Каждый день',
  weekdays: 'Будни (Пн-Пт)',
  weekly:   'Каждую неделю',
  monthly:  'Каждый месяц',
  yearly:   'Каждый год',
  custom:   'Настраиваемый',
};

const TYPE_LABELS: Record<TaskType, string> = {
  normal:    'Обычная',
  mandatory: 'Обязательная',
  event:     'Эвент',
};

interface Props {
  date: Date;
  onSave: (task: Omit<Task, 'id' | 'status'>) => void;
  onClose: () => void;
}

export function CreateTaskModal({ date, onSave, onClose }: Props) {
  const [title,  setTitle]  = useState('');
  const [time,   setTime]   = useState('');
  const [repeat, setRepeat] = useState<TaskRepeat>('none');
  const [type,   setType]   = useState<TaskType>('normal');

  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => { titleRef.current?.focus(); }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onSave({
      title:  trimmed,
      time:   time || undefined,
      repeat,
      type,
      date:   toDateStr(date),
    });
    onClose();
  };

  const dateLabel = date.toLocaleDateString('ru', { day: 'numeric', month: 'long', weekday: 'short' });

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      header={
        <div>
          <h2 className={styles.title}>Новая задача</h2>
          <span className={styles.dateHint}>{dateLabel}</span>
        </div>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button
            variant="accent"
            type="submit"
            form="create-task-form"
            disabled={!title.trim()}
          >
            Создать
          </Button>
        </>
      }
    >
      <form id="create-task-form" className={styles.form} onSubmit={handleSubmit}>
        <Input
          ref={titleRef}
          label="Название"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Что нужно сделать?"
          required
        />

        <Input
          label="Время"
          helper="необязательно"
          type="time"
          value={time}
          onChange={e => setTime(e.target.value)}
        />

        <div className={styles.row}>
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

          <div className={styles.field}>
            <label className={styles.label}>Тип</label>
            <select
              className={styles.select}
              value={type}
              onChange={e => setType(e.target.value as TaskType)}
            >
              {(Object.keys(TYPE_LABELS) as TaskType[]).map(t => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
        </div>
      </form>
    </Modal>
  );
}
