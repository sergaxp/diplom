'use client';

import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Camera } from 'lucide-react';
import { AvatarFramed } from '../../../components/AvatarFramed';
import { profileApi, UpdateProfilePayload } from '../../../lib/profile';
import { User } from '../../../lib/auth';
import { Button, Input, Textarea } from '../../../components/ui';
import { SectionHeader } from '../SectionHeader';
import { buildProfilePayload, isProfileDirty } from '../payload';
import { ProfileForm } from '../types';
import { SocialLinksEditor } from './SocialLinksEditor';
import styles from '../page.module.scss';

export function ProfileTab({ user, setUser }: { user: User; setUser: (u: User | null) => void }) {
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<ProfileForm>({
    displayName: user.displayName ?? '',
    username:    user.username ?? '',
    bio:         user.bio ?? '',
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const initial: ProfileForm = {
    displayName: user.displayName ?? '',
    username:    user.username    ?? '',
    bio:         user.bio         ?? '',
  };

  const avatarMut = useMutation({
    mutationFn: profileApi.uploadAvatar,
    onSuccess: setUser,
    onError: () => setError('Не удалось загрузить фото'),
  });
  const coverMut = useMutation({
    mutationFn: profileApi.uploadCover,
    onSuccess: setUser,
    onError: () => setError('Не удалось загрузить баннер'),
  });
  const profileMut = useMutation({
    mutationFn: profileApi.update,
    onSuccess: (u: User) => {
      setUser(u);
      setSaved(true);
      setError('');
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      setError(err?.response?.data?.message ?? 'Не удалось сохранить');
    },
  });

  const dirty = isProfileDirty(form, initial);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.username.trim()) { setError('Имя пользователя не может быть пустым'); return; }

    const payload: UpdateProfilePayload = buildProfilePayload(form, initial);
    if (Object.keys(payload).length === 0) return;
    profileMut.mutate(payload);
  };

  return (
    <>
      <SectionHeader title="Профиль" subtitle="Эта информация будет видна на вашем публичном профиле." />

      <div className={styles.section}>
        <label className={styles.label}>Аватар</label>
        <div className={styles.avatarRow}>
          <button
            type="button"
            className={styles.avatarBtn}
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarMut.isPending}
            aria-label="Загрузить аватар"
          >
            <AvatarFramed
              avatarUrl={user.avatarUrl}
              displayName={user.displayName}
              username={user.username}
              frameId={user.selectedFrame}
              size={88}
            />
            <span className={styles.avatarOverlay}>
              <Camera size={20} strokeWidth={1.75} />
            </span>
          </button>
          <div className={styles.avatarMeta}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              loading={avatarMut.isPending}
            >
              Загрузить фото
            </Button>
            <span className={styles.hint}>PNG, JPG или GIF · до 5 МБ</span>
          </div>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/gif"
            className={styles.fileInput} onChange={e => { const f = e.target.files?.[0]; if (f) avatarMut.mutate(f); e.target.value=''; }} />
        </div>
      </div>

      <div className={styles.section}>
        <label className={styles.label}>Баннер профиля</label>
        <button
          type="button"
          className={styles.coverBtn}
          onClick={() => coverInputRef.current?.click()}
          disabled={coverMut.isPending}
        >
          {user.coverUrl
            // eslint-disable-next-line @next/next/no-img-element -- баннер из пользовательского upload, оптимизация next/image не нужна
            ? <img src={user.coverUrl} alt="banner" className={styles.coverImg} />
            : <span className={styles.coverPlaceholder}>{coverMut.isPending ? 'Загрузка...' : '+ Загрузить баннер'}</span>}
          {user.coverUrl && <span className={styles.coverOverlay}>{coverMut.isPending ? '...' : 'Изменить'}</span>}
        </button>
        <input ref={coverInputRef} type="file" accept="image/png,image/jpeg,image/gif"
          className={styles.fileInput} onChange={e => { const f = e.target.files?.[0]; if (f) coverMut.mutate(f); e.target.value=''; }} />
        <span className={styles.hint}>PNG, JPG или GIF · до 8 МБ · рекомендуется 1500×500</span>
      </div>

      <form className={styles.form} onSubmit={submit}>
        <Input
          label="Отображаемое имя"
          type="text"
          value={form.displayName}
          maxLength={64}
          placeholder="Как тебя называть"
          onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
        />

        <Input
          label="Имя пользователя"
          type="text"
          value={form.username}
          maxLength={32}
          placeholder="username"
          prefix="@"
          onChange={e => setForm(f => ({ ...f, username: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') }))}
        />

        <Textarea
          label="О себе"
          value={form.bio}
          maxLength={200}
          rows={3}
          placeholder="Расскажи немного о себе"
          helper={`${form.bio.length}/200`}
          onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
        />

        {error && <div className={styles.error}>{error}</div>}
        {saved && <div className={styles.success}>Сохранено</div>}

        <div className={styles.actions}>
          <Button
            type="submit"
            variant="accent"
            loading={profileMut.isPending}
            disabled={!dirty}
          >
            Сохранить изменения
          </Button>
        </div>
      </form>

      <SocialLinksEditor user={user} setUser={setUser} />
    </>
  );
}
