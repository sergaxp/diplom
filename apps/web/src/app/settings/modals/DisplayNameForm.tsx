'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { profileApi } from '../../../lib/profile';
import { User } from '../../../lib/auth';
import { Button, Input } from '../../../components/ui';
import styles from '../page.module.scss';

export function DisplayNameForm({
  user, setUser, onDone,
}: {
  user: User;
  setUser: (u: User | null) => void;
  onDone?: () => void;
}) {
  const [value, setValue] = useState(user.displayName ?? '');
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: () => profileApi.update({ displayName: value.trim() || undefined }),
    onSuccess: (u: User) => { setUser(u); setError(''); onDone?.(); },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      setError(err?.response?.data?.message ?? 'Не удалось сохранить');
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    mut.mutate();
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <Input
        label="Отображаемое имя"
        type="text"
        value={value}
        maxLength={64}
        placeholder="Как тебя называть"
        onChange={e => setValue(e.target.value)}
      />

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.actions}>
        {onDone && <Button type="button" variant="secondary" onClick={onDone} disabled={mut.isPending}>Отмена</Button>}
        <Button
          type="submit"
          variant="accent"
          loading={mut.isPending}
          disabled={value.trim() === (user.displayName ?? '')}
        >
          Сохранить
        </Button>
      </div>
    </form>
  );
}
