'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { profileApi, UpdateProfilePayload } from '../../../lib/profile';
import { reverseGeocode } from '../../../lib/weather';
import { fetchGeoSuggestions, GeoSuggestion } from '../../../lib/geocoding';
import { User } from '../../../lib/auth';
import { Button, IconButton, Input } from '../../../components/ui';
import { SectionHeader } from '../SectionHeader';
import { buildManagerPayload } from '../payload';
import { ManagerForm } from '../types';
import styles from '../page.module.scss';

export function ManagerTab({ user, setUser }: { user: User; setUser: (u: User | null) => void }) {
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
    const payload: UpdateProfilePayload = buildManagerPayload(form, initial);
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
              <Input
                type="text"
                value={form.location}
                maxLength={100}
                placeholder="Введите город..."
                autoComplete="off"
                onChange={e => handleLocationInput(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                wrapClassName={styles.locationInputField}
              />
              <IconButton
                icon={<MapPin size={16} strokeWidth={1.75} />}
                aria-label="Определить местоположение"
                variant="secondary"
                size="md"
                onClick={handleDetectLocation}
                loading={geoLoading}
                className={styles.geoBtn}
              />
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
          <Button type="submit" variant="accent" loading={mut.isPending}>
            Сохранить
          </Button>
        </div>
      </form>
    </>
  );
}
