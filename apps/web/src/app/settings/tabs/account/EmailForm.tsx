'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { profileApi } from '../../../../lib/profile';
import { User } from '../../../../lib/auth';
import { Button, Input } from '../../../../components/ui';
import styles from '../../page.module.scss';

export function EmailForm({
  user, setUser, onDone,
}: {
  user: User;
  setUser: (u: User | null) => void;
  onDone?: () => void;
}) {
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');

  const mut = useMutation({
    mutationFn: profileApi.changeEmail,
    onSuccess: (u: User) => {
      setUser(u);
      setNewEmail('');
      setPassword('');
      setError('');
      onDone?.();
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      setError(err?.response?.data?.message ?? 'Не удалось изменить email');
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!newEmail.trim() || !password) return;
    mut.mutate({ newEmail: newEmail.trim(), password });
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <p className={styles.sectionDesc}>Текущий email: <b>{user.email}</b></p>

      <Input
        label="Новый email"
        type="email"
        value={newEmail}
        maxLength={255}
        placeholder="new@example.com"
        onChange={e => setNewEmail(e.target.value)}
      />

      <Input
        label="Пароль для подтверждения"
        type="password"
        value={password}
        autoComplete="current-password"
        onChange={e => setPassword(e.target.value)}
      />

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.actions}>
        {onDone && <Button type="button" variant="secondary" onClick={onDone} disabled={mut.isPending}>Отмена</Button>}
        <Button
          type="submit"
          variant="accent"
          loading={mut.isPending}
          disabled={!newEmail.trim() || !password}
        >
          Изменить email
        </Button>
      </div>
    </form>
  );
}
