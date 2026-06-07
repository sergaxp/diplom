'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { profileApi } from '../../../../lib/profile';
import { Button, Input } from '../../../../components/ui';
import styles from '../../page.module.scss';

export function PasswordForm() {
  const [currentPassword, setCurrent] = useState('');
  const [newPassword,     setNewPwd]  = useState('');
  const [confirmPassword, setConfirm] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: profileApi.changePassword,
    onSuccess: () => {
      setCurrent(''); setNewPwd(''); setConfirm('');
      setSaved(true);
      setError('');
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      setError(err?.response?.data?.message ?? 'Не удалось изменить пароль');
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) { setError('Новый пароль должен быть минимум 8 символов'); return; }
    if (newPassword !== confirmPassword) { setError('Пароли не совпадают'); return; }
    mut.mutate({ currentPassword, newPassword });
  };

  return (
    <form className={styles.section} onSubmit={submit}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionTitle}>Пароль</span>
        <span className={styles.sectionDesc}>Минимум 8 символов.</span>
      </div>

      <Input
        label="Текущий пароль"
        type="password"
        value={currentPassword}
        autoComplete="current-password"
        onChange={e => setCurrent(e.target.value)}
      />

      <Input
        label="Новый пароль"
        type="password"
        value={newPassword}
        autoComplete="new-password"
        onChange={e => setNewPwd(e.target.value)}
      />

      <Input
        label="Подтвердите новый пароль"
        type="password"
        value={confirmPassword}
        autoComplete="new-password"
        onChange={e => setConfirm(e.target.value)}
      />

      {error && <div className={styles.error}>{error}</div>}
      {saved && <div className={styles.success}>Пароль обновлён</div>}

      <div className={styles.actions}>
        <Button
          type="submit"
          variant="accent"
          loading={mut.isPending}
          disabled={!currentPassword || !newPassword || !confirmPassword}
        >
          Изменить пароль
        </Button>
      </div>
    </form>
  );
}
