'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { feedbackApi } from '../../lib/feedback';
import { Modal, Button, Input, Textarea } from '../ui';
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
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Заявка на нововведение"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button
            type="submit"
            form="feature-request-form"
            variant="accent"
            loading={isPending}
          >
            Отправить
          </Button>
        </>
      }
    >
      <form id="feature-request-form" className={styles.form} onSubmit={submit}>
        <Input
          label={<>Название <span className={styles.required}>*</span></>}
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Что вы хотите добавить?"
          maxLength={255}
        />

        <Textarea
          label="Описание"
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="Подробнее опишите идею: зачем нужна, как должна работать..."
          rows={6}
        />

        {error && <p className={styles.error}>{error}</p>}
      </form>
    </Modal>
  );
}
