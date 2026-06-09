'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { profileApi } from '../../../lib/profile';
import { User } from '../../../lib/auth';
import { Button, Modal, Switch } from '../../../components/ui';
import { SectionHeader } from '../SectionHeader';
import { SettingsSection } from '../components/SettingsSection';
import { SettingsRow } from '../components/SettingsRow';
import { LocationForm } from '../modals/LocationForm';
import styles from '../page.module.scss';

export function ManagerTab({ user, setUser }: { user: User; setUser: (u: User | null) => void }) {
  const [locationOpen, setLocationOpen] = useState(false);

  const toggleMut = useMutation({
    mutationFn: (patch: { showGlobalEvents?: boolean; showHolidays?: boolean }) => profileApi.update(patch),
    onMutate: (patch) => {
      const prev = user;
      setUser({ ...user, ...patch });
      return { prev };
    },
    onSuccess: (u: User) => setUser(u),
    onError: (_e, _v, ctx) => { if (ctx?.prev) setUser(ctx.prev); },
  });

  return (
    <>
      <SectionHeader title="Менеджер" subtitle="Настройки погоды и отображения событий." />

      <SettingsSection title="Погода">
        <SettingsRow
          label="Местоположение"
          description="Используется для прогноза погоды в задачах"
        >
          <span className={styles.rowValue}>
            {user.location || <span className={styles.rowValueMuted}>Не указано</span>}
          </span>
          <Button variant="secondary" size="sm" onClick={() => setLocationOpen(true)}>Изменить</Button>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Отображение">
        <SettingsRow
          label="Глобальные события"
          description="Показывать события администратора в календаре"
        >
          <Switch
            checked={user.showGlobalEvents ?? true}
            onChange={e => toggleMut.mutate({ showGlobalEvents: e.target.checked })}
          />
        </SettingsRow>

        <SettingsRow
          label="Праздничные дни"
          description="Показывать праздники в календаре"
        >
          <Switch
            checked={user.showHolidays ?? true}
            onChange={e => toggleMut.mutate({ showHolidays: e.target.checked })}
          />
        </SettingsRow>
      </SettingsSection>

      <Modal open={locationOpen} onClose={() => setLocationOpen(false)} title="Местоположение" size="sm">
        <LocationForm user={user} setUser={setUser} onDone={() => setLocationOpen(false)} />
      </Modal>
    </>
  );
}
