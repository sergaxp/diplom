'use client';

import { useEffect } from 'react';
import { RepeatConfig } from '../../../lib/tasks';
import { useRepeatConfig } from '../../../hooks/useRepeatConfig';
import { Modal, Button } from '../../ui';
import { ScheduleSection } from './ScheduleSection';
import { ConditionsSection } from './ConditionsSection';
import { EndingSection } from './EndingSection';
import styles from './RepeatConfigModal.module.scss';

interface Props {
  initial?: RepeatConfig | null;
  selectedDate: string;
  /** Конечная дата задачи (для multiDay) – нужна для расчёта min значений */
  taskEndDate?: string;
  multiDay?: boolean;
  onSave: (cfg: RepeatConfig, repeatUntil?: string) => void;
  onClose: () => void;
}

export function RepeatConfigModal({ initial, selectedDate, taskEndDate, multiDay = false, onSave, onClose }: Props) {
  const r = useRepeatConfig({ initial, selectedDate, taskEndDate, multiDay });

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const handleSave = () => {
    const { cfg, until } = r.getResult();
    onSave(cfg, until);
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Настройка повтора"
      noPadding
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button
            variant="accent"
            onClick={handleSave}
          >
            Сохранить
          </Button>
        </>
      }
    >
        <div className={styles.body}>
          <ScheduleSection r={r} multiDay={multiDay} />
          <ConditionsSection r={r} multiDay={multiDay} />
          <EndingSection r={r} />
        </div>
    </Modal>
  );
}
