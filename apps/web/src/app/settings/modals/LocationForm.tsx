'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { profileApi } from '../../../lib/profile';
import { reverseGeocode } from '../../../lib/weather';
import { fetchGeoSuggestions, GeoSuggestion } from '../../../lib/geocoding';
import { User } from '../../../lib/auth';
import { Button, IconButton, Input } from '../../../components/ui';
import styles from '../page.module.scss';

export function LocationForm({
  user, setUser, onDone,
}: {
  user: User;
  setUser: (u: User | null) => void;
  onDone?: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [location, setLocation] = useState(user.location ?? '');
  const [lat, setLat] = useState<number | null>(user.locationLat ?? null);
  const [lon, setLon] = useState<number | null>(user.locationLon ?? null);
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const mut = useMutation({
    mutationFn: () => profileApi.update({
      location: location.trim() || undefined,
      locationLat: lat ?? undefined,
      locationLon: lon ?? undefined,
    }),
    onSuccess: (u: User) => { setUser(u); setError(''); onDone?.(); },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      setError(err?.response?.data?.message ?? 'Не удалось сохранить');
    },
  });

  const handleInput = (value: string) => {
    setLocation(value); setLat(null); setLon(null);
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

  const handleDetect = () => {
    if (!navigator.geolocation) { setError('Браузер не поддерживает геолокацию'); return; }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const city = await reverseGeocode(coords.latitude, coords.longitude).catch(() => null);
        setGeoLoading(false);
        if (city) { setLocation(city); setLat(coords.latitude); setLon(coords.longitude); }
        else setError('Не удалось определить город');
      },
      () => { setGeoLoading(false); setError('Нет доступа к геолокации'); },
    );
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    mut.mutate();
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.field}>
        <label className={styles.label}>Местоположение</label>
        <div className={styles.locationWrap} ref={wrapRef}>
          <div className={styles.locationInputRow}>
            <Input
              type="text"
              value={location}
              maxLength={100}
              placeholder="Введите город..."
              autoComplete="off"
              onChange={e => handleInput(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              wrapClassName={styles.locationInputField}
            />
            <IconButton
              icon={<MapPin size={16} strokeWidth={1.75} />}
              aria-label="Определить местоположение"
              variant="secondary"
              size="md"
              onClick={handleDetect}
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
                    setLocation(s.name); setLat(s.latitude); setLon(s.longitude);
                    setSuggestions([]); setShowSuggestions(false);
                  }}>
                  <span className={styles.suggestCity}>{s.name}</span>
                  <span className={styles.suggestRegion}>{[s.admin1, s.country].filter(Boolean).join(', ')}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <span className={styles.hint}>
          {lat
            ? `${lat.toFixed(2)}° с.ш., ${lon?.toFixed(2)}° в.д.`
            : 'Используется для прогноза погоды в задачах'}
        </span>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.actions}>
        {onDone && <Button type="button" variant="secondary" onClick={onDone} disabled={mut.isPending}>Отмена</Button>}
        <Button type="submit" variant="accent" loading={mut.isPending}>Сохранить</Button>
      </div>
    </form>
  );
}
