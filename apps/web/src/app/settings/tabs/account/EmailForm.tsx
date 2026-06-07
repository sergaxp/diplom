'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { profileApi } from '../../../../lib/profile';
import { User } from '../../../../lib/auth';
import { Button, Input } from '../../../../components/ui';
import styles from '../../page.module.scss';

export function EmailForm({ user, setUser }: { user: User; setUser: (u: User | null) => void }) {
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState('');

  const mut = useMutation({
    mutationFn: profileApi.changeEmail,
    onSuccess: (u: User) => {
      setUser(u);
      setNewEmail('');
      setPassword('');
      setSaved(true);
      setError('');
      setTimeout(() => setSaved(false), 3000);
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
    <form className={styles.section} onSubmit={submit}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionTitle}>Email</span>
        <span className={styles.sectionDesc}>Текущий: <b>{user.email}</b></span>
      </div>

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
      {saved && <div className={styles.success}>Email обновлён</div>}

      <div className={styles.actions}>
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
