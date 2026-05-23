'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  User as UserIcon, Shield, Settings as SettingsIcon, Palette, Tags as TagsIcon, AlertTriangle,
} from 'lucide-react';
import { Header } from '../../components/Header';
import { AvatarFramed } from '../../components/AvatarFramed';
import { useAuthStore } from '../../store/authStore';
import { profileApi, UpdateProfilePayload } from '../../lib/profile';
import { reverseGeocode } from '../../lib/weather';
import { clearAuth, User } from '../../lib/auth';
import { tagsApi } from '../../lib/tags';
import { shopApi } from '../../lib/shop';
import { SOCIAL_PROVIDERS, getSocialIcon } from '../../lib/socials';
import { TagManager } from '../../components/manager/TagManager';
import styles from './page.module.scss';

type TabId = 'profile' | 'account' | 'manager' | 'appearance' | 'tags';

interface GeoSuggestion {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
  timezone: string;
}

interface ProfileForm {
  displayName: string;
  username:    string;
  bio:         string;
}

interface ManagerForm {
  location:         string;
  locationLat:      number | null;
  locationLon:      number | null;
  showGlobalEvents: boolean;
  showHolidays:     boolean;
}

async function fetchGeoSuggestions(query: string): Promise<GeoSuggestion[]> {
  if (query.trim().length < 2) return [];
  const params = new URLSearchParams({
    name: query.trim(), count: '6', language: 'ru', format: 'json',
  });
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
  if (!res.ok) return [];
  const json = await res.json();
  return json.results ?? [];
}

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'profile',    label: 'Профиль',       icon: <UserIcon size={16} strokeWidth={1.75}/> },
  { id: 'account',    label: 'Аккаунт',       icon: <Shield size={16} strokeWidth={1.75}/> },
  { id: 'manager',    label: 'Менеджер',      icon: <SettingsIcon size={16} strokeWidth={1.75}/> },
  { id: 'appearance', label: 'Внешний вид',   icon: <Palette size={16} strokeWidth={1.75}/> },
  { id: 'tags',       label: 'Теги',          icon: <TagsIcon size={16} strokeWidth={1.75}/> },
];

export default function SettingsPage() {
  const { user, ready, setUser, logout } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();

  const [tab, setTab] = useState<TabId>('profile');

  useEffect(() => {
    if (ready && !user) router.replace('/auth');
  }, [ready, user, router]);

  if (!ready || !user) return null;

  return (
    <div className={styles.root}>
      <Header />
      <div className={styles.body}>
        <div className={styles.layout}>
          {/* ── Sidebar ── */}
          <aside className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
              <AvatarFramed
                avatarUrl={user.avatarUrl}
                displayName={user.displayName}
                username={user.username}
                frameId={user.selectedFrame}
                size={48}
              />
              <div className={styles.sidebarUser}>
                <span className={styles.sidebarName}>{user.displayName ?? user.username}</span>
                <span className={styles.sidebarEmail}>{user.email}</span>
              </div>
            </div>

            <nav className={styles.navList}>
              {TABS.map(t => (
                <button
                  key={t.id}
                  type="button"
                  className={[styles.navItem, tab === t.id ? styles.navItemActive : ''].join(' ')}
                  onClick={() => setTab(t.id)}
                >
                  <span className={styles.navIcon}>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </nav>

            <div className={styles.sidebarFooter}>
              <Link href={`/profile/${user.username}`} className={styles.sidebarLink}>
                ← Вернуться в профиль
              </Link>
            </div>
          </aside>

          {/* ── Content ── */}
          <main className={styles.content}>
            {tab === 'profile'    && <ProfileTab    user={user} setUser={setUser} />}
            {tab === 'account'    && <AccountTab    user={user} setUser={setUser} onDeleted={() => { logout(); clearAuth(); router.replace('/'); }} />}
            {tab === 'manager'    && <ManagerTab    user={user} setUser={setUser} />}
            {tab === 'appearance' && <AppearanceTab user={user} setUser={setUser} />}
            {tab === 'tags'       && <TagsTab user={user} qc={qc} />}
          </main>
        </div>
      </div>
    </div>
  );
}

// ── Profile Tab ──────────────────────────────────────────────────
function ProfileTab({ user, setUser }: { user: User; setUser: (u: User | null) => void }) {
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

  const dirty =
    form.displayName.trim() !== initial.displayName ||
    form.username.trim()    !== initial.username    ||
    form.bio.trim()         !== initial.bio;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.username.trim()) { setError('Имя пользователя не может быть пустым'); return; }

    const payload: UpdateProfilePayload = {};
    if (form.displayName.trim() !== initial.displayName) payload.displayName = form.displayName.trim() || undefined;
    if (form.username.trim()    !== initial.username)    payload.username    = form.username.trim() || undefined;
    if (form.bio.trim()         !== initial.bio)         payload.bio         = form.bio.trim() || undefined;

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
          >
            <AvatarFramed
              avatarUrl={user.avatarUrl}
              displayName={user.displayName}
              username={user.username}
              frameId={user.selectedFrame}
              size={88}
            />
            <span className={styles.avatarOverlay}>{avatarMut.isPending ? '...' : '📷'}</span>
          </button>
          <div className={styles.avatarMeta}>
            <button
              type="button"
              className={styles.btn}
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarMut.isPending}
            >
              Загрузить фото
            </button>
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
            ? <img src={user.coverUrl} alt="banner" className={styles.coverImg}/>
            : <span className={styles.coverPlaceholder}>{coverMut.isPending ? 'Загрузка...' : '+ Загрузить баннер'}</span>}
          {user.coverUrl && <span className={styles.coverOverlay}>{coverMut.isPending ? '...' : 'Изменить'}</span>}
        </button>
        <input ref={coverInputRef} type="file" accept="image/png,image/jpeg,image/gif"
          className={styles.fileInput} onChange={e => { const f = e.target.files?.[0]; if (f) coverMut.mutate(f); e.target.value=''; }} />
        <span className={styles.hint}>PNG, JPG или GIF · до 8 МБ · рекомендуется 1500×500</span>
      </div>

      <form className={styles.form} onSubmit={submit}>
        <div className={styles.field}>
          <label className={styles.label}>Отображаемое имя</label>
          <input
            className={styles.input}
            type="text"
            value={form.displayName}
            maxLength={64}
            placeholder="Как тебя называть"
            onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Имя пользователя</label>
          <div className={styles.usernameWrap}>
            <span className={styles.at}>@</span>
            <input
              className={styles.usernameInput}
              type="text"
              value={form.username}
              maxLength={32}
              placeholder="username"
              onChange={e => setForm(f => ({ ...f, username: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') }))}
            />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>О себе</label>
          <textarea
            className={styles.textarea}
            value={form.bio}
            maxLength={200}
            rows={3}
            placeholder="Расскажи немного о себе"
            onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
          />
          <span className={styles.counter}>{form.bio.length}/200</span>
        </div>

        {error && <div className={styles.error}>{error}</div>}
        {saved && <div className={styles.success}>Сохранено</div>}

        <div className={styles.actions}>
          <button
            type="submit"
            className={[styles.btn, styles.btnPrimary].join(' ')}
            disabled={profileMut.isPending || !dirty}
          >
            {profileMut.isPending ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
        </div>
      </form>

      <SocialLinksEditor user={user} setUser={setUser} />
    </>
  );
}

// ── Social Links Editor ──────────────────────────────────────────
function SocialLinksEditor({ user, setUser }: { user: User; setUser: (u: User | null) => void }) {
  const [links, setLinks] = useState<Record<string, string>>(() => user.socialLinks ?? {});
  const [savedFlag, setSavedFlag] = useState(false);

  const mut = useMutation({
    mutationFn: (next: Record<string, string>) => profileApi.update({ socialLinks: next }),
    onMutate: (next) => {
      const prev = user;
      setUser({ ...user, socialLinks: next });
      return { prev };
    },
    onSuccess: (u: User) => {
      setUser(u);
      setSavedFlag(true);
      setTimeout(() => setSavedFlag(false), 1500);
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) setUser(ctx.prev); },
  });

  const commit = (next: Record<string, string>) => {
    setLinks(next);
    mut.mutate(next);
  };

  const setOne = (id: string, value: string) => {
    const next = { ...links, [id]: value };
    setLinks(next);
  };

  const removeOne = (id: string) => {
    const next = { ...links };
    delete next[id];
    commit(next);
  };

  const blurSave = (id: string) => {
    const v = (links[id] ?? '').trim();
    const current = user.socialLinks?.[id] ?? '';
    if (v === current) return;
    if (!v) {
      removeOne(id);
      return;
    }
    commit({ ...links, [id]: v });
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionTitle}>Ссылки на соцсети</span>
        <span className={styles.sectionDesc}>
          Будут отображаться на странице вашего профиля. Оставьте поле пустым, чтобы удалить ссылку.
        </span>
      </div>

      <div className={styles.socialEditList}>
        {SOCIAL_PROVIDERS.map(p => {
          const Ic = getSocialIcon(p.id);
          const value = links[p.id] ?? '';
          return (
            <div key={p.id} className={styles.socialRow}>
              <span className={styles.socialRowIcon} style={{ color: p.color, background: p.color + '1f' }}>
                {Ic && <Ic size={14} strokeWidth={2}/>}
              </span>
              <span className={styles.socialRowLabel}>{p.label}</span>
              <input
                className={[styles.input, styles.socialRowInput].join(' ')}
                type="text"
                value={value}
                placeholder={p.placeholder ?? ''}
                onChange={e => setOne(p.id, e.target.value)}
                onBlur={() => blurSave(p.id)}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              />
              {value && (
                <button
                  type="button"
                  className={styles.socialRowRemove}
                  onClick={() => removeOne(p.id)}
                  title="Удалить ссылку"
                >×</button>
              )}
            </div>
          );
        })}
      </div>

      {savedFlag && <div className={styles.success}>Сохранено</div>}
    </div>
  );
}

// ── Account Tab ──────────────────────────────────────────────────
function AccountTab({
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

function EmailForm({ user, setUser }: { user: User; setUser: (u: User | null) => void }) {
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

      <div className={styles.field}>
        <label className={styles.label}>Новый email</label>
        <input
          className={styles.input}
          type="email"
          value={newEmail}
          maxLength={255}
          placeholder="new@example.com"
          onChange={e => setNewEmail(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Пароль для подтверждения</label>
        <input
          className={styles.input}
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={e => setPassword(e.target.value)}
        />
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {saved && <div className={styles.success}>Email обновлён</div>}

      <div className={styles.actions}>
        <button
          type="submit"
          className={[styles.btn, styles.btnPrimary].join(' ')}
          disabled={mut.isPending || !newEmail.trim() || !password}
        >
          {mut.isPending ? 'Сохранение...' : 'Изменить email'}
        </button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const [currentPassword, setCurrent] = useState('');
  const [newPassword,     setNewPwd]  = useState('');
  const [confirmPassword, setConfirm] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: profileApi.changePassword,
    onSuccess: () => {
      setCurrent(''); setNewPwd(''); setConfirm('');
      setSaved(true);
      setError('');
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      setError(err?.response?.data?.message ?? 'Не удалось изменить пароль');
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) { setError('Новый пароль должен быть минимум 8 символов'); return; }
    if (newPassword !== confirmPassword) { setError('Пароли не совпадают'); return; }
    mut.mutate({ currentPassword, newPassword });
  };

  return (
    <form className={styles.section} onSubmit={submit}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionTitle}>Пароль</span>
        <span className={styles.sectionDesc}>Минимум 8 символов.</span>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Текущий пароль</label>
        <input className={styles.input} type="password" value={currentPassword}
          autoComplete="current-password"
          onChange={e => setCurrent(e.target.value)}/>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Новый пароль</label>
        <input className={styles.input} type="password" value={newPassword}
          autoComplete="new-password"
          onChange={e => setNewPwd(e.target.value)}/>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Подтвердите новый пароль</label>
        <input className={styles.input} type="password" value={confirmPassword}
          autoComplete="new-password"
          onChange={e => setConfirm(e.target.value)}/>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {saved && <div className={styles.success}>Пароль обновлён</div>}

      <div className={styles.actions}>
        <button
          type="submit"
          className={[styles.btn, styles.btnPrimary].join(' ')}
          disabled={mut.isPending || !currentPassword || !newPassword || !confirmPassword}
        >
          {mut.isPending ? 'Сохранение...' : 'Изменить пароль'}
        </button>
      </div>
    </form>
  );
}

function DangerZone({ user, onDeleted }: { user: User; onDeleted: () => void }) {
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
          <AlertTriangle size={15} strokeWidth={2}/> Опасная зона
        </span>
        <span className={styles.sectionDesc}>Удаление аккаунта необратимо.</span>
      </div>

      {!confirmOpen ? (
        <div className={styles.actions}>
          <button
            type="button"
            className={[styles.btn, styles.btnDanger].join(' ')}
            onClick={() => { setConfirmOpen(true); setError(''); }}
          >
            Удалить мой аккаунт
          </button>
        </div>
      ) : (
        <form onSubmit={handleDelete}>
          <p className={styles.dangerText}>
            Все ваши задачи, теги, достижения и покупки будут удалены без возможности восстановления.
          </p>

          <div className={styles.field}>
            <label className={styles.label}>
              Введите <code className={styles.codeChip}>{user.username}</code> для подтверждения
            </label>
            <input
              className={styles.input}
              type="text"
              value={usernameCheck}
              onChange={e => setUsernameCheck(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Пароль</label>
            <input
              className={styles.input}
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.btn}
              onClick={() => { setConfirmOpen(false); setPassword(''); setUsernameCheck(''); setError(''); }}
              disabled={mut.isPending}
            >
              Отмена
            </button>
            <button
              type="submit"
              className={[styles.btn, styles.btnDanger].join(' ')}
              disabled={mut.isPending || !password || usernameCheck !== user.username}
            >
              {mut.isPending ? 'Удаление...' : 'Удалить навсегда'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Manager Tab ──────────────────────────────────────────────────
function ManagerTab({ user, setUser }: { user: User; setUser: (u: User | null) => void }) {
  const locationWrapRef = useRef<HTMLDivElement>(null);
  const debounceRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initial: ManagerForm = {
    location:         user.location         ?? '',
    locationLat:      user.locationLat      ?? null,
    locationLon:      user.locationLon      ?? null,
    showGlobalEvents: user.showGlobalEvents ?? true,
    showHolidays:     user.showHolidays     ?? true,
  };

  const [form, setForm] = useState<ManagerForm>(initial);
  const [suggestions,     setSuggestions]     = useState<GeoSuggestion[]>([]);
  const [suggestLoading,  setSuggestLoading]  = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [geoLoading,      setGeoLoading]      = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (locationWrapRef.current && !locationWrapRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const mut = useMutation({
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

  const handleLocationInput = (value: string) => {
    setForm(f => ({ ...f, location: value, locationLat: null, locationLon: null }));
    setShowSuggestions(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSuggestLoading(true);
      const results = await fetchGeoSuggestions(value);
      setSuggestions(results);
      setSuggestLoading(false);
      setShowSuggestions(results.length > 0);
    }, 400);
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) { setError('Браузер не поддерживает геолокацию'); return; }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const city = await reverseGeocode(coords.latitude, coords.longitude).catch(() => null);
        setGeoLoading(false);
        if (city) setForm(f => ({ ...f, location: city, locationLat: coords.latitude, locationLon: coords.longitude }));
        else setError('Не удалось определить город');
      },
      () => { setGeoLoading(false); setError('Нет доступа к геолокации'); },
    );
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const payload: UpdateProfilePayload = {};
    if (form.location.trim() !== initial.location) {
      payload.location    = form.location.trim() || undefined;
      payload.locationLat = form.locationLat ?? undefined;
      payload.locationLon = form.locationLon ?? undefined;
    }
    if (form.showGlobalEvents !== initial.showGlobalEvents) payload.showGlobalEvents = form.showGlobalEvents;
    if (form.showHolidays     !== initial.showHolidays)     payload.showHolidays     = form.showHolidays;
    if (Object.keys(payload).length === 0) { setSaved(true); setTimeout(() => setSaved(false), 1500); return; }
    mut.mutate(payload);
  };

  return (
    <>
      <SectionHeader title="Менеджер" subtitle="Настройки погоды и отображения событий." />

      <form className={styles.form} onSubmit={submit}>
        <div className={styles.field}>
          <label className={styles.label}>Местоположение</label>
          <div className={styles.locationWrap} ref={locationWrapRef}>
            <div className={styles.locationInputRow}>
              <input
                className={styles.input}
                type="text"
                value={form.location}
                maxLength={100}
                placeholder="Введите город..."
                autoComplete="off"
                onChange={e => handleLocationInput(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              />
              <button type="button" className={styles.geoBtn}
                onClick={handleDetectLocation} disabled={geoLoading}
                title="Определить автоматически">
                {geoLoading ? '...' : '📍'}
              </button>
            </div>

            {(showSuggestions || suggestLoading) && (
              <div className={styles.suggestions}>
                {suggestLoading && <div className={styles.suggestLoading}>Поиск...</div>}
                {!suggestLoading && suggestions.map(s => (
                  <button key={s.id} type="button" className={styles.suggestion}
                    onClick={() => {
                      setForm(f => ({ ...f, location: s.name, locationLat: s.latitude, locationLon: s.longitude }));
                      setSuggestions([]); setShowSuggestions(false);
                    }}>
                    <span className={styles.suggestCity}>{s.name}</span>
                    <span className={styles.suggestRegion}>
                      {[s.admin1, s.country].filter(Boolean).join(', ')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className={styles.hint}>
            {form.locationLat
              ? `${form.locationLat.toFixed(2)}° с.ш., ${form.locationLon?.toFixed(2)}° в.д.`
              : 'Используется для прогноза погоды в задачах'}
          </span>
        </div>

        <div className={styles.field}>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={form.showGlobalEvents}
              onChange={e => setForm(f => ({ ...f, showGlobalEvents: e.target.checked }))}
            />
            <span>Показывать глобальные события администратора</span>
          </label>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={form.showHolidays}
              onChange={e => setForm(f => ({ ...f, showHolidays: e.target.checked }))}
            />
            <span>Показывать праздничные дни в календаре</span>
          </label>
        </div>

        {error && <div className={styles.error}>{error}</div>}
        {saved && <div className={styles.success}>Сохранено</div>}

        <div className={styles.actions}>
          <button type="submit" className={[styles.btn, styles.btnPrimary].join(' ')} disabled={mut.isPending}>
            {mut.isPending ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </form>
    </>
  );
}

// ── Appearance Tab ───────────────────────────────────────────────
function AppearanceTab({ user, setUser }: { user: User; setUser: (u: User | null) => void }) {
  const { data: shopItems = [] } = useQuery({
    queryKey: ['shop', 'items'],
    queryFn: shopApi.getItems,
  });
  const ownedFrames = shopItems.filter(i => i.kind === 'frame' && i.owned);

  const mut = useMutation({
    mutationFn: (frameId: string | null) => profileApi.update({ selectedFrame: frameId }),
    // Optimistic update –  рамка применяется немедленно в Header и профиле
    onMutate: (frameId) => {
      const prev = user;
      setUser({ ...user, selectedFrame: frameId });
      return { prev };
    },
    onSuccess: (u: User) => setUser(u),
    onError: (_e, _v, ctx) => { if (ctx?.prev) setUser(ctx.prev); },
  });

  return (
    <>
      <SectionHeader
        title="Внешний вид"
        subtitle={
          <>
            Выберите рамку аватара. Новые рамки можно купить в{' '}
            <Link href="/shop" className={styles.inlineLink}>магазине</Link>.
          </>
        }
      />

      <div className={styles.section}>
        <label className={styles.label}>Рамка аватара</label>
        <div className={styles.frameGrid}>
          <button
            type="button"
            className={[styles.frameOption, !user.selectedFrame ? styles.frameOptionActive : ''].join(' ')}
            onClick={() => mut.mutate(null)}
            disabled={mut.isPending}
          >
            <AvatarFramed
              avatarUrl={user.avatarUrl}
              displayName={user.displayName}
              username={user.username}
              frameId={null}
              size={64}
            />
            <span className={styles.frameLabel}>Без рамки</span>
          </button>

          {ownedFrames.map(f => (
            <button
              key={f.id}
              type="button"
              className={[styles.frameOption, user.selectedFrame === f.id ? styles.frameOptionActive : ''].join(' ')}
              onClick={() => mut.mutate(f.id)}
              disabled={mut.isPending}
              title={f.title}
            >
              <AvatarFramed
                avatarUrl={user.avatarUrl}
                displayName={user.displayName}
                username={user.username}
                frameId={f.id}
                size={64}
              />
              <span className={styles.frameLabel} style={{ color: f.meta?.color }}>
                {f.title}
              </span>
            </button>
          ))}

          {ownedFrames.length === 0 && (
            <div className={styles.framesEmpty}>
              У вас пока нет купленных рамок. Загляните в{' '}
              <Link href="/shop" className={styles.inlineLink}>магазин</Link>.
            </div>
          )}
        </div>
      </div>

    </>
  );
}

// ── Tags Tab ─────────────────────────────────────────────────────
function TagsTab({ user, qc }: { user: User; qc: ReturnType<typeof useQueryClient> }) {
  const { data: userTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: tagsApi.getAll,
    enabled: !!user,
    staleTime: 60_000,
  });

  const createTagMut = useMutation({
    mutationFn: tagsApi.create,
    onSettled: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  });
  const deleteTagMut = useMutation({
    mutationFn: tagsApi.remove,
    onSettled: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  });
  const updateTagMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof tagsApi.update>[1] }) =>
      tagsApi.update(id, data),
    onSettled: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  });

  return (
    <>
      <SectionHeader
        title="Теги"
        subtitle="Теги помогают группировать задачи. Иконка тега отображается в календаре вместо точки."
      />
      <div className={styles.section}>
        <TagManager
          tags={userTags}
          alwaysOpen
          onCreate={d => createTagMut.mutate(d)}
          onDelete={id => deleteTagMut.mutate(id)}
          onUpdate={(id, d) => updateTagMut.mutate({ id, data: d })}
        />
      </div>
    </>
  );
}

// ── Shared ───────────────────────────────────────────────────────
function SectionHeader({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) {
  return (
    <div className={styles.pageHead}>
      <h1 className={styles.pageTitle}>{title}</h1>
      {subtitle && <p className={styles.pageSubtitle}>{subtitle}</p>}
    </div>
  );
}
