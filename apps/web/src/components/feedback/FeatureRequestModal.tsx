'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { feedbackApi } from '../../lib/feedback';
import styles from './FeedbackModal.module.scss';

interface Props {
  onClose: () => void;
}

export function FeatureRequestModal({ onClose }: Props) {
  const qc = useQueryClient();

  const [title, setTitle] = useState('');
  const [desc, setDesc]   = useState('');
  const [error, setError] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: () => feedbackApi.createFeatureRequest({
      title: title.trim(),
      description: desc.trim() || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-feature-requests'] });
      onClose();
    },
    onError: () => setError('Не удалось отправить. Попробуйте снова.'),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Введите название'); return; }
    setError('');
    mutate();
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.headerTitle}>Заявка на нововведение</span>
          <button className={styles.closeBtn} onClick={onClose}><X size={16} /></button>
        </div>

        <form className={styles.form} onSubmit={submit}>
          <label className={styles.label}>
            Название <span className={styles.required}>*</span>
          </label>
          <input
            className={styles.input}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Что вы хотите добавить?"
            maxLength={255}
          />

          <label className={styles.label}>Описание</label>
          <textarea
            className={styles.textarea}
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Подробнее опишите идею: зачем нужна, как должна работать..."
            rows={6}
          />

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Отмена</button>
            <button type="submit" className={styles.submitBtn} disabled={isPending}>
              {isPending ? 'Отправка...' : 'Отправить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
