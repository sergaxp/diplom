'use client';

import { Modal, Button } from '../../components/ui';
import styles from './DeleteScopeModal.module.scss';

interface Props {
  open: boolean;
  taskTitle: string;
  /** Подпись выбранного дня, напр. «9 мая» */
  dayLabel: string;
  onOnlyThis: () => void;
  onThisAndFuture: () => void;
  onWholeSeries: () => void;
  onClose: () => void;
}

/**
 * Диалог выбора области удаления для многодневной/повторяющейся задачи:
 * только выбранный день, этот день и все последующие, либо вся серия целиком.
 */
export function DeleteScopeModal({
  open, taskTitle, dayLabel, onOnlyThis, onThisAndFuture, onWholeSeries, onClose,
}: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Удалить задачу"
      footer={<Button variant="secondary" size="sm" onClick={onClose}>Отмена</Button>}
    >
      <p className={styles.desc}>
        «{taskTitle}» — это часть серии. Что удалить для дня <b>{dayLabel}</b>?
      </p>
      <div className={styles.list}>
        <button type="button" className={styles.choiceBtn} onClick={onOnlyThis}>
          Только этот день
        </button>
        <button type="button" className={styles.choiceBtn} onClick={onThisAndFuture}>
          Этот день и все будущие
        </button>
        <button type="button" className={styles.choiceBtn} onClick={onWholeSeries}>
          Удалить всю серию
        </button>
      </div>
    </Modal>
  );
}
