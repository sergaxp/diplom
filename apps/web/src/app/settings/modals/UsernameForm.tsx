'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { profileApi } from '../../../lib/profile';
import { User } from '../../../lib/auth';
import { Button, Input } from '../../../components/ui';
import styles from '../page.module.scss';

export function UsernameForm({
  user, setUser, onDone,
}: {
  user: User;
  setUser: (u: User | null) => void;
  onDone?: () => void;
}) {
  const [value, setValue] = useState(user.username ?? '');
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: () => profileApi.update({ username: value.trim() }),
    onSuccess: (u: User) => { setUser(u); setError(''); onDone?.(); },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      setError(err?.response?.data?.message ?? 'Не удалось изменить имя пользователя');
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!value.trim()) { setError('Имя пользователя не может быть пустым'); return; }
    mut.mutate();
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <Input
        label="Имя пользователя"
        type="text"
        value={value}
        maxLength={32}
        placeholder="username"
        prefix="@"
        onChange={e => setValue(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
      />
      <span className={styles.hint}>Латиница, цифры, дефис и подчёркивание. От 3 до 32 символов.</span>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.actions}>
        {onDone && <Button type="button" variant="secondary" onClick={onDone} disabled={mut.isPending}>Отмена</Button>}
        <Button
          type="submit"
          variant="accent"
          loading={mut.isPending}
          disabled={!value.trim() || value.trim() === user.username}
        >
          Сохранить
        </Button>
      </div>
    </form>
  );
}
