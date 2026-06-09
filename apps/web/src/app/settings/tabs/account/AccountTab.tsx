'use client';

import { useState } from 'react';
import { User } from '../../../../lib/auth';
import { Button, Modal } from '../../../../components/ui';
import { SectionHeader } from '../../SectionHeader';
import { SettingsSection } from '../../components/SettingsSection';
import { SettingsRow } from '../../components/SettingsRow';
import { UsernameForm } from '../../modals/UsernameForm';
import { EmailForm } from './EmailForm';
import { PasswordForm } from './PasswordForm';
import { DangerZone } from './DangerZone';
import styles from '../../page.module.scss';

type AccountModal = 'username' | 'email' | 'password' | 'delete';

/** Маскирует email: оставляет первый символ и домен. */
function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!domain) return '••••••••';
  return `${name[0] ?? ''}${'•'.repeat(Math.max(name.length - 1, 3))}@${domain}`;
}

export function AccountTab({
  user, setUser, onDeleted,
}: {
  user: User;
  setUser: (u: User | null) => void;
  onDeleted: () => void;
}) {
  const [modal, setModal] = useState<AccountModal | null>(null);
  const [emailRevealed, setEmailRevealed] = useState(false);
  const close = () => setModal(null);

  return (
    <>
      <SectionHeader title="Моя учётная запись" subtitle="Управление именем пользователя, почтой, паролем и доступом." />

      <SettingsSection title="Информация об учётной записи">
        <SettingsRow label="Имя пользователя">
          <span className={styles.rowValue}>@{user.username}</span>
          <Button variant="secondary" size="sm" onClick={() => setModal('username')}>Изменить</Button>
        </SettingsRow>

        <SettingsRow label="Электронная почта">
          <span className={styles.rowValue}>{emailRevealed ? user.email : maskEmail(user.email)}</span>
          <button type="button" className={styles.revealBtn} onClick={() => setEmailRevealed(v => !v)}>
            {emailRevealed ? 'Скрыть' : 'Показать'}
          </button>
          <Button variant="secondary" size="sm" onClick={() => setModal('email')}>Изменить</Button>
        </SettingsRow>

        <SettingsRow label="Пароль">
          <span className={styles.rowValue}>••••••••••</span>
          <Button variant="secondary" size="sm" onClick={() => setModal('password')}>Изменить</Button>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Удаление аккаунта" danger>
        <SettingsRow
          label="Удалить аккаунт"
          description="Безвозвратно удаляет ваш профиль и все связанные данные."
        >
          <Button variant="destructive" size="sm" onClick={() => setModal('delete')}>Удалить</Button>
        </SettingsRow>
      </SettingsSection>

      <Modal open={modal === 'username'} onClose={close} title="Изменить имя пользователя" size="sm">
        <UsernameForm user={user} setUser={setUser} onDone={close} />
      </Modal>
      <Modal open={modal === 'email'} onClose={close} title="Изменить email" size="sm">
        <EmailForm user={user} setUser={setUser} onDone={close} />
      </Modal>
      <Modal open={modal === 'password'} onClose={close} title="Изменить пароль" size="sm">
        <PasswordForm onDone={close} />
      </Modal>
      <Modal open={modal === 'delete'} onClose={close} title="Удаление аккаунта" size="sm">
        <DangerZone user={user} onDeleted={onDeleted} onDone={close} />
      </Modal>
    </>
  );
}
