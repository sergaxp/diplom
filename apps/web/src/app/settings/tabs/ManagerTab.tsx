'use client';

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { profileApi } from '../../../lib/profile';
import { User } from '../../../lib/auth';
import { Button, Modal, Switch } from '../../../components/ui';
import { SectionHeader } from '../SectionHeader';
import { SettingsSection } from '../components/SettingsSection';
import { SettingsRow } from '../components/SettingsRow';
import { LocationForm } from '../modals/LocationForm';
import { getPushState, registerPush, unregisterPush, type PushState } from '../../../lib/push';
import styles from '../page.module.scss';

export function ManagerTab({ user, setUser }: { user: User; setUser: (u: User | null) => void }) {
  const [locationOpen, setLocationOpen] = useState(false);
  const [pushState, setPushState] = useState<PushState | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => { void getPushState().then(setPushState); }, []);

  const togglePush = async (enable: boolean) => {
    setPushBusy(true);
    try {
      if (enable) await registerPush();
      else await unregisterPush();
    } finally {
      setPushState(await getPushState());
      setPushBusy(false);
    }
  };

  const toggleMut = useMutation({
    mutationFn: (patch: { showGlobalEvents?: boolean; showHolidays?: boolean; reminderDefaultTime?: string }) => profileApi.update(patch),
    onMutate: (patch) => {
      const prev = user;
      setUser({ ...user, ...patch });
      return { prev };
    },
    onSuccess: (u: User) => setUser(u),
    onError: (_e, _v, ctx) => { if (ctx?.prev) setUser(ctx.prev); },
  });

  const pushDenied = pushState?.permission === 'denied';
  const pushUnsupported = pushState ? !pushState.supported : false;

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

      <SettingsSection title="Напоминания">
        <SettingsRow
          label="Push-уведомления"
          description={
            pushUnsupported
              ? 'Браузер не поддерживает фоновые уведомления'
              : pushDenied
                ? 'Разрешите уведомления в настройках браузера'
                : 'Получать напоминания, даже когда сайт закрыт'
          }
        >
          <Switch
            checked={!!pushState?.subscribed}
            disabled={pushBusy || pushDenied || pushUnsupported}
            onChange={e => { void togglePush(e.target.checked); }}
          />
        </SettingsRow>

        <SettingsRow
          label="Время напоминаний без времени"
          description="Когда срабатывают напоминания у задач без указанного времени"
        >
          <input
            type="time"
            className={styles.timeInput}
            value={user.reminderDefaultTime ?? '09:00'}
            onChange={e => { if (e.target.value) toggleMut.mutate({ reminderDefaultTime: e.target.value }); }}
          />
        </SettingsRow>

        <SettingsRow
          label="iPhone / iPad"
          description="Добавьте сайт на экран «Домой» (Поделиться → На экран Домой), чтобы напоминания приходили в фоне"
        />
      </SettingsSection>

      <Modal open={locationOpen} onClose={() => setLocationOpen(false)} title="Местоположение" size="sm">
        <LocationForm user={user} setUser={setUser} onDone={() => setLocationOpen(false)} />
      </Modal>
    </>
  );
}
