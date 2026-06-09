'use client';

import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AvatarFramed } from '../../../components/AvatarFramed';
import { profileApi } from '../../../lib/profile';
import { User } from '../../../lib/auth';
import { SOCIAL_PROVIDERS } from '../../../lib/socials';
import { Icon } from '../../../lib/icons';
import { Button, Modal } from '../../../components/ui';
import { SectionHeader } from '../SectionHeader';
import { SettingsSection } from '../components/SettingsSection';
import { SettingsRow } from '../components/SettingsRow';
import { DisplayNameForm } from '../modals/DisplayNameForm';
import { BioForm } from '../modals/BioForm';
import { SocialLinksEditor } from './SocialLinksEditor';
import styles from '../page.module.scss';

type ProfileModal = 'displayName' | 'bio' | 'socials';

export function ProfileTab({ user, setUser }: { user: User; setUser: (u: User | null) => void }) {
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef    = useRef<HTMLInputElement>(null);

  const [modal, setModal] = useState<ProfileModal | null>(null);
  const [error, setError] = useState('');
  const close = () => setModal(null);

  const avatarMut = useMutation({ mutationFn: profileApi.uploadAvatar, onSuccess: setUser, onError: () => setError('Не удалось загрузить фото') });
  const coverMut  = useMutation({ mutationFn: profileApi.uploadCover,  onSuccess: setUser, onError: () => setError('Не удалось загрузить баннер') });
  const bgMut     = useMutation({ mutationFn: profileApi.uploadBackground, onSuccess: setUser, onError: () => setError('Не удалось загрузить фон') });

  const delAvatarMut = useMutation({ mutationFn: profileApi.deleteAvatar, onSuccess: setUser, onError: () => setError('Не удалось удалить фото') });
  const delCoverMut  = useMutation({ mutationFn: profileApi.deleteCover,  onSuccess: setUser, onError: () => setError('Не удалось удалить баннер') });
  const delBgMut     = useMutation({ mutationFn: profileApi.deleteBackground, onSuccess: setUser, onError: () => setError('Не удалось удалить фон') });

  const activeSocials = SOCIAL_PROVIDERS.filter(p => (user.socialLinks?.[p.id] ?? '').trim());

  return (
    <>
      <SectionHeader title="Профиль" subtitle="Эта информация будет видна на вашем публичном профиле." />

      {error && <div className={styles.error}>{error}</div>}

      <SettingsSection title="Изображения профиля">
        <SettingsRow label="Аватар" description="PNG, JPG или GIF · до 5 МБ" align="start">
          <button
            type="button"
            className={styles.avatarBtn}
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarMut.isPending}
            aria-label="Загрузить аватар"
          >
            <AvatarFramed avatarUrl={user.avatarUrl} displayName={user.displayName} username={user.username} frameId={user.selectedFrame} size={56} />
          </button>
          <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} loading={avatarMut.isPending}>
            Изменить
          </Button>
          {user.avatarUrl && (
            <Button variant="ghost" size="sm" onClick={() => delAvatarMut.mutate()} loading={delAvatarMut.isPending}>
              Удалить
            </Button>
          )}
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/gif"
            className={styles.fileInput} onChange={e => { const f = e.target.files?.[0]; if (f) avatarMut.mutate(f); e.target.value=''; }} />
        </SettingsRow>

        <SettingsRow label="Баннер профиля" description="до 8 МБ · рекомендуется 1500×500" align="start">
          {user.coverUrl
            // eslint-disable-next-line @next/next/no-img-element -- баннер из пользовательского upload
            ? <img src={user.coverUrl} alt="banner" className={styles.rowPreview} />
            : <span className={styles.rowPreviewEmpty}>Нет баннера</span>}
          <Button variant="secondary" size="sm" onClick={() => coverInputRef.current?.click()} loading={coverMut.isPending}>
            Изменить
          </Button>
          {user.coverUrl && (
            <Button variant="ghost" size="sm" onClick={() => delCoverMut.mutate()} loading={delCoverMut.isPending}>
              Удалить
            </Button>
          )}
          <input ref={coverInputRef} type="file" accept="image/png,image/jpeg,image/gif"
            className={styles.fileInput} onChange={e => { const f = e.target.files?.[0]; if (f) coverMut.mutate(f); e.target.value=''; }} />
        </SettingsRow>

        <SettingsRow label="Фон профиля (своё изображение)" description="Полностраничная подложка · до 8 МБ" align="start">
          {user.backgroundUrl
            // eslint-disable-next-line @next/next/no-img-element -- фон из пользовательского upload
            ? <img src={user.backgroundUrl} alt="background" className={styles.rowPreview} />
            : <span className={styles.rowPreviewEmpty}>Нет фона</span>}
          <Button variant="secondary" size="sm" onClick={() => bgInputRef.current?.click()} loading={bgMut.isPending}>
            Изменить
          </Button>
          {user.backgroundUrl && (
            <Button variant="ghost" size="sm" onClick={() => delBgMut.mutate()} loading={delBgMut.isPending}>
              Удалить
            </Button>
          )}
          <input ref={bgInputRef} type="file" accept="image/png,image/jpeg,image/gif"
            className={styles.fileInput} onChange={e => { const f = e.target.files?.[0]; if (f) bgMut.mutate(f); e.target.value=''; }} />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Информация">
        <SettingsRow label="Отображаемое имя">
          <span className={styles.rowValue}>{user.displayName || <span className={styles.rowValueMuted}>Не указано</span>}</span>
          <Button variant="secondary" size="sm" onClick={() => setModal('displayName')}>Изменить</Button>
        </SettingsRow>

        <SettingsRow label="О себе">
          <span className={[styles.rowValue, styles.rowValueClamp].join(' ')}>
            {user.bio || <span className={styles.rowValueMuted}>Не указано</span>}
          </span>
          <Button variant="secondary" size="sm" onClick={() => setModal('bio')}>Изменить</Button>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Социальные сети">
        <SettingsRow
          label="Социальные ссылки"
          description={activeSocials.length ? `Подключено: ${activeSocials.length}` : 'Не добавлены'}
        >
          {activeSocials.length > 0 && (
            <span className={styles.rowSocialIcons}>
              {activeSocials.map(p => (
                <span key={p.id} className={styles.rowSocialIcon} style={{ color: p.color, background: p.color + '1f' }} title={p.label}>
                  <Icon name={p.icon} size={13} strokeWidth={2} />
                </span>
              ))}
            </span>
          )}
          <Button variant="secondary" size="sm" onClick={() => setModal('socials')}>Изменить</Button>
        </SettingsRow>
      </SettingsSection>

      <Modal open={modal === 'displayName'} onClose={close} title="Отображаемое имя" size="sm">
        <DisplayNameForm user={user} setUser={setUser} onDone={close} />
      </Modal>
      <Modal open={modal === 'bio'} onClose={close} title="О себе" size="sm">
        <BioForm user={user} setUser={setUser} onDone={close} />
      </Modal>
      <Modal open={modal === 'socials'} onClose={close} title="Социальные ссылки" size="md">
        <SocialLinksEditor user={user} setUser={setUser} />
      </Modal>
    </>
  );
}
