'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Header } from '../../components/Header';
import { useAuthStore } from '../../store/authStore';
import { profileApi, UpdateProfilePayload } from '../../lib/profile';
import { reverseGeocode } from '../../lib/weather';
import { User } from '../../lib/auth';
import { tagsApi } from '../../lib/tags';
import { TagManager } from '../../components/manager/TagManager';
import styles from './page.module.scss';

// ── Тип подсказки геокодинга ──────────────────────────────────
interface GeoSuggestion {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
  timezone: string;
}

// ── Состояние формы ───────────────────────────────────────────
interface FormValues {
  displayName:      string;
  username:         string;
  bio:              string;
  location:         string;
  locationLat:      number | null;
  locationLon:      number | null;
  showGlobalEvents: boolean;
}

function fromUser(user: User): FormValues {
  return {
    displayName:      user.displayName      ?? '',
    username:         user.username         ?? '',
    bio:              user.bio              ?? '',
    location:         user.location         ?? '',
    locationLat:      user.locationLat      ?? null,
    locationLon:      user.locationLon      ?? null,
    showGlobalEvents: user.showGlobalEvents ?? true,
  };
}

// ── Геокодинг подсказок ───────────────────────────────────────
async function fetchGeoSuggestions(query: string): Promise<GeoSuggestion[]> {
  if (query.trim().length < 2) return [];
  const params = new URLSearchParams({
    name: query.trim(), count: '6', language: 'ru', format: 'json',
  });
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?${params}`,
  );
  if (!res.ok) return [];
  const json = await res.json();
  return json.results ?? [];
}

// ── Компонент страницы ────────────────────────────────────────
export default function SettingsPage() {
  const { user, ready, setUser } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const locationWrapRef = useRef<HTMLDivElement>(null);
  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emptyForm: FormValues = { displayName: '', username: '', bio: '', location: '', locationLat: null, locationLon: null, showGlobalEvents: true };

  const [form,        setForm]        = useState<FormValues>(emptyForm);
  const [initial,     setInitial]     = useState<FormValues>(emptyForm);
  const [saved,       setSaved]       = useState(false);
  const [error,       setError]       = useState('');
  const [geoLoading,  setGeoLoading]  = useState(false);

  // Автодополнение
  const [suggestions,     setSuggestions]     = useState<GeoSuggestion[]>([]);
  const [suggestLoading,  setSuggestLoading]  = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // ── Авторизация ───────────────────────────────────────────
  useEffect(() => {
    if (ready && !user) router.replace('/auth');
  }, [ready, user, router]);

  useEffect(() => {
    if (user) {
      const vals = fromUser(user);
      setForm(vals);
      setInitial(vals);
    }
  }, [user]);

  // Закрываем дропдаун при клике вне
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (locationWrapRef.current && !locationWrapRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Мутации ───────────────────────────────────────────────
  const avatarMut = useMutation({
    mutationFn: profileApi.uploadAvatar,
    onSuccess: (updated: User) => { setUser(updated); setError(''); },
    onError: () => setError('Не удалось загрузить фото'),
  });

  const profileMut = useMutation({
    mutationFn: profileApi.update,
    onSuccess: (updated: User) => {
      setUser(updated);
      const v = fromUser(updated);
      setInitial(v);
      setForm(v);
      setSaved(true);
      setError('');
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      setError(err?.response?.data?.message ?? 'Не удалось сохранить');
    },
  });

  // ── Теги ─────────────────────────────────────────────────────
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

  // ── Локация: ввод с дебаунсом ─────────────────────────────
  const handleLocationInput = (value: string) => {
    // Сбрасываем сохранённые координаты при ручном вводе
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

  const handleSuggestionPick = (s: GeoSuggestion) => {
    setForm(f => ({
      ...f,
      location:    s.name,
      locationLat: s.latitude,
      locationLon: s.longitude,
    }));
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // ── Геолокация браузера ───────────────────────────────────
  const handleDetectLocation = () => {
    if (!navigator.geolocation) { setError('Браузер не поддерживает геолокацию'); return; }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { latitude, longitude } = coords;
        const city = await reverseGeocode(latitude, longitude).catch(() => null);
        setGeoLoading(false);
        if (city) {
          setForm(f => ({ ...f, location: city, locationLat: latitude, locationLon: longitude }));
        } else {
          setError('Не удалось определить город');
        }
      },
      () => { setGeoLoading(false); setError('Нет доступа к геолокации'); },
    );
  };

  // ── Загрузка фото ─────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) avatarMut.mutate(file);
    e.target.value = '';
  };

  // ── Сохранение формы ──────────────────────────────────────
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.username.trim()) {
      setError('Имя пользователя не может быть пустым');
      return;
    }
    if (form.displayName && !form.displayName.trim()) {
      setError('Отображаемое имя не может состоять только из пробелов');
      return;
    }

    const payload: UpdateProfilePayload = {};
    if (form.displayName.trim() !== initial.displayName)  payload.displayName = form.displayName.trim() || undefined;
    if (form.username.trim()    !== initial.username)     payload.username    = form.username.trim()    || undefined;
    if (form.bio.trim()         !== initial.bio)          payload.bio         = form.bio.trim()         || undefined;
    if (form.location.trim()    !== initial.location) {
      payload.location    = form.location.trim()    || undefined;
      payload.locationLat = form.locationLat        ?? undefined;
      payload.locationLon = form.locationLon        ?? undefined;
    }
    if (form.showGlobalEvents !== initial.showGlobalEvents)
      payload.showGlobalEvents = form.showGlobalEvents;

    if (Object.keys(payload).length === 0) {
      setSaved(true); setTimeout(() => setSaved(false), 2000); return;
    }
    profileMut.mutate(payload);
  };

  if (!ready || !user) return null;

  const initial_ = (user.displayName || user.username || '?')[0].toUpperCase();
  const loading  = avatarMut.isPending || profileMut.isPending;

  return (
    <div className={styles.root}>
      <Header />
      <div className={styles.body}>
        <div className={styles.card}>
          <h1 className={styles.title}>Настройки профиля</h1>

          {/* Аватар */}
          <div className={styles.avatarSection}>
            <button
              className={styles.avatarBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarMut.isPending}
              title="Нажмите для загрузки фото"
            >
              {user.avatarUrl
                ? <img src={user.avatarUrl} alt="avatar" className={styles.avatarImg} />
                : <span className={styles.avatarInitial}>{initial_}</span>}
              <span className={styles.avatarOverlay}>{avatarMut.isPending ? '...' : '📷'}</span>
            </button>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/gif"
              className={styles.fileInput} onChange={handleFileChange} />
            <div className={styles.avatarHint}>PNG, JPG или GIF · до 5 МБ</div>
          </div>

          {/* Форма */}
          <form className={styles.form} onSubmit={handleSave}>

            <label className={styles.field}>
              <span className={styles.label}>Отображаемое имя</span>
              <input className={styles.input} type="text" value={form.displayName}
                maxLength={64} placeholder="Как тебя называть"
                onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Имя пользователя</span>
              <div className={styles.usernameWrap}>
                <span className={styles.at}>@</span>
                <input className={styles.usernameInput} type="text" value={form.username}
                  maxLength={32} placeholder="username"
                  onChange={e => setForm(f => ({
                    ...f, username: e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''),
                  }))} />
              </div>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>О себе</span>
              <textarea className={styles.textarea} value={form.bio} maxLength={200} rows={3}
                placeholder="Расскажи немного о себе"
                onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} />
              <span className={styles.counter}>{form.bio.length}/200</span>
            </label>

            {/* Местоположение с автодополнением */}
            <div className={styles.field}>
              <span className={styles.label}>Местоположение</span>
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

                {/* Дропдаун подсказок */}
                {(showSuggestions || suggestLoading) && (
                  <div className={styles.suggestions}>
                    {suggestLoading && <div className={styles.suggestLoading}>Поиск...</div>}
                    {!suggestLoading && suggestions.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        className={styles.suggestion}
                        onClick={() => handleSuggestionPick(s)}
                      >
                        <span className={styles.suggestCity}>{s.name}</span>
                        <span className={styles.suggestRegion}>
                          {[s.admin1, s.country].filter(Boolean).join(', ')}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span className={styles.fieldHint}>
                {form.locationLat
                  ? `${form.locationLat.toFixed(2)}° с.ш., ${form.locationLon?.toFixed(2)}° в.д.`
                  : 'Используется для погоды в менеджере задач'}
              </span>
            </div>

            {/* Менеджер задач */}
            <div className={styles.field}>
              <span className={styles.label}>Менеджер задач</span>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={form.showGlobalEvents}
                  onChange={e => setForm(f => ({ ...f, showGlobalEvents: e.target.checked }))}
                />
                <span className={styles.checkboxLabel}>Показывать глобальные события администратора</span>
              </label>
            </div>

            {error && <div className={styles.error}>{error}</div>}
            {saved  && <div className={styles.success}>Сохранено</div>}

            <button className={styles.saveBtn} type="submit" disabled={loading}>
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </form>

          {/* ── Теги ── */}
          <div className={styles.tagsSection}>
            <h2 className={styles.tagsSectionTitle}>Теги задач</h2>
            <p className={styles.tagsSectionDesc}>Теги помогают группировать задачи. Иконка тега отображается в календаре вместо точки.</p>
            <TagManager
              tags={userTags}
              alwaysOpen
              onCreate={d => createTagMut.mutate(d)}
              onDelete={id => deleteTagMut.mutate(id)}
              onUpdate={(id, d) => updateTagMut.mutate({ id, data: d })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
