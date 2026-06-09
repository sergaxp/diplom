'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { profileApi } from '../../../lib/profile';
import { User } from '../../../lib/auth';
import { Button, Textarea } from '../../../components/ui';
import styles from '../page.module.scss';

export function BioForm({
  user, setUser, onDone,
}: {
  user: User;
  setUser: (u: User | null) => void;
  onDone?: () => void;
}) {
  const [value, setValue] = useState(user.bio ?? '');
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: () => profileApi.update({ bio: value.trim() || undefined }),
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
      <Textarea
        label="О себе"
        value={value}
        maxLength={200}
        rows={4}
        placeholder="Расскажи немного о себе"
        helper={`${value.length}/200`}
        onChange={e => setValue(e.target.value)}
      />

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.actions}>
        {onDone && <Button type="button" variant="secondary" onClick={onDone} disabled={mut.isPending}>Отмена</Button>}
        <Button
          type="submit"
          variant="accent"
          loading={mut.isPending}
          disabled={value.trim() === (user.bio ?? '')}
        >
          Сохранить
        </Button>
      </div>
    </form>
  );
}
