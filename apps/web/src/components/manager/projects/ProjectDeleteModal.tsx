'use client';

import { AlertTriangle } from 'lucide-react';
import { Modal, Button } from '../../ui';
import type { DeleteProjectMode } from '../../../lib/projects';
import styles from './ProjectDeleteModal.module.scss';

interface Props {
  open: boolean;
  projectName: string;
  onClose: () => void;
  onConfirm: (mode: DeleteProjectMode) => void;
}

export function ProjectDeleteModal({ open, projectName, onClose, onConfirm }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={`Удалить проект «${projectName}»?`}
    >
      <div className={styles.body}>
        <p className={styles.warn}>
          <AlertTriangle size={16} /> Действие необратимо. Что сделать с задачами проекта?
        </p>

        <button type="button" className={styles.option} onClick={() => onConfirm('keepCompleted')}>
          <span className={styles.optTitle}>Отвязать выполненные</span>
          <span className={styles.optDesc}>
            Выполненные задачи останутся у вас (станут личными). Начатые и не начатые — удалятся.
          </span>
        </button>

        <button type="button" className={[styles.option, styles.optionDanger].join(' ')} onClick={() => onConfirm('deleteAll')}>
          <span className={styles.optTitle}>Удалить все задачи</span>
          <span className={styles.optDesc}>Проект и все его задачи будут удалены безвозвратно.</span>
        </button>

        <div className={styles.footer}>
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
        </div>
      </div>
    </Modal>
  );
}
