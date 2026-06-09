'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AvatarFramed } from '../../../components/AvatarFramed';
import { User } from '../../../lib/auth';
import { shopApi } from '../../../lib/shop';
import { Button, Modal } from '../../../components/ui';
import { SectionHeader } from '../SectionHeader';
import { SettingsSection } from '../components/SettingsSection';
import { SettingsRow } from '../components/SettingsRow';
import { FramePicker } from '../modals/FramePicker';
import { BackgroundPicker } from '../modals/BackgroundPicker';
import styles from '../page.module.scss';

type AppearanceModal = 'frame' | 'background';

export function AppearanceTab({ user, setUser }: { user: User; setUser: (u: User | null) => void }) {
  const [modal, setModal] = useState<AppearanceModal | null>(null);
  const close = () => setModal(null);

  const { data: shopItems = [] } = useQuery({ queryKey: ['shop', 'items'], queryFn: shopApi.getItems });
  const currentFrame = shopItems.find(i => i.id === user.selectedFrame);
  const currentBg = shopItems.find(i => i.id === user.selectedBackground);

  return (
    <>
      <SectionHeader
        title="Внешний вид"
        subtitle={<>Оформление профиля. Новые рамки и фоны можно купить в <Link href="/shop" className={styles.inlineLink}>магазине</Link>.</>}
      />

      <SettingsSection title="Оформление профиля">
        <SettingsRow
          label="Рамка аватара"
          description={user.selectedFrame ? (currentFrame?.title ?? 'Выбрана') : 'Без рамки'}
          align="start"
        >
          <AvatarFramed avatarUrl={user.avatarUrl} displayName={user.displayName} username={user.username} frameId={user.selectedFrame} size={48} />
          <Button variant="secondary" size="sm" onClick={() => setModal('frame')}>Изменить</Button>
        </SettingsRow>

        <SettingsRow
          label="Фон профиля из магазина"
          description={user.selectedBackground ? (currentBg?.title ?? 'Выбран') : 'Без фона'}
          align="start"
        >
          {currentBg?.meta?.video ? (
            <video className={styles.bgSwatch} src={currentBg.meta.video} muted loop autoPlay playsInline preload="metadata" />
          ) : (
            <span className={styles.bgSwatch} style={{ background: currentBg?.meta?.gradient ?? 'var(--bg-subtle)' }} />
          )}
          <Button variant="secondary" size="sm" onClick={() => setModal('background')}>Изменить</Button>
        </SettingsRow>
      </SettingsSection>

      <Modal open={modal === 'frame'} onClose={close} title="Рамка аватара" size="md">
        <FramePicker user={user} setUser={setUser} />
      </Modal>
      <Modal open={modal === 'background'} onClose={close} title="Фон профиля из магазина" size="md">
        <BackgroundPicker user={user} setUser={setUser} />
      </Modal>
    </>
  );
}
