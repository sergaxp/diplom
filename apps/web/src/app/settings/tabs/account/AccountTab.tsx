'use client';

import { User } from '../../../../lib/auth';
import { SectionHeader } from '../../SectionHeader';
import { EmailForm } from './EmailForm';
import { PasswordForm } from './PasswordForm';
import { DangerZone } from './DangerZone';

export function AccountTab({
  user, setUser, onDeleted,
}: {
  user: User;
  setUser: (u: User | null) => void;
  onDeleted: () => void;
}) {
  return (
    <>
      <SectionHeader title="Аккаунт" subtitle="Управление почтой, паролем и доступом к аккаунту." />
      <EmailForm    user={user} setUser={setUser} />
      <PasswordForm />
      <DangerZone   user={user} onDeleted={onDeleted} />
    </>
  );
}
