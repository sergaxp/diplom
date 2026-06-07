'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { profileApi } from '../../../../lib/profile';
import { User } from '../../../../lib/auth';
import { Button, Input } from '../../../../components/ui';
import styles from '../../page.module.scss';

export function DangerZone({ user, onDeleted }: { user: User; onDeleted: () => void }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [password,    setPassword]    = useState('');
  const [usernameCheck, setUsernameCheck] = useState('');
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: profileApi.deleteAccount,
    onSuccess: onDeleted,
    onError: (err: { response?: { data?: { message?: string } } }) => {
      setError(err?.response?.data?.message ?? 'Не удалось удалить аккаунт');
    },
  });

  const handleDelete = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (usernameCheck !== user.username) { setError(`Введите "${user.username}" для подтверждения`); return; }
    if (!password) { setError('Введите пароль'); return; }
    mut.mutate(password);
  };

  return (
    <div className={[styles.section, styles.dangerSection].join(' ')}>
      <div className={styles.sectionHead}>
        <span className={[styles.sectionTitle, styles.dangerTitle].join(' ')}>
          <AlertTriangle size={16} strokeWidth={2} /> Опасная зона
        </span>
        <span className={styles.sectionDesc}>Удаление аккаунта необратимо.</span>
      </div>

      {!confirmOpen ? (
        <div className={styles.actions}>
          <Button
            variant="destructive"
            onClick={() => { setConfirmOpen(true); setError(''); }}
          >
            Удалить мой аккаунт
          </Button>
        </div>
      ) : (
        <form onSubmit={handleDelete}>
          <p className={styles.dangerText}>
            Все ваши задачи, теги, достижения и покупки будут удалены без возможности восстановления.
          </p>

          <Input
            label={<>Введите <code className={styles.codeChip}>{user.username}</code> для подтверждения</>}
            type="text"
            value={usernameCheck}
            onChange={e => setUsernameCheck(e.target.value)}
            autoComplete="off"
          />

          <Input
            label="Пароль"
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={e => setPassword(e.target.value)}
          />

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <Button
              variant="secondary"
              onClick={() => { setConfirmOpen(false); setPassword(''); setUsernameCheck(''); setError(''); }}
              disabled={mut.isPending}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              variant="destructive"
              loading={mut.isPending}
              disabled={!password || usernameCheck !== user.username}
            >
              Удалить навсегда
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
