'use client';

import { useEffect } from 'react';
import { useCurrentWeather, weatherCodeToEmoji } from '../lib/weather';
import { useAuthStore } from '../store/authStore';

/** Заголовок вкладки для входа/welcome — фирменный слоган. */
export const STATIC_TITLE = 'Warmingtea – твоё личное пространство';

const BRAND = 'Warmingtea';

/**
 * Динамический заголовок вкладки вида «☀️ +24° Warmingtea · Место».
 * Эмодзи и температуру берём из текущей погоды (по локации пользователя,
 * дефолт — Челябинск). Пока погода не загрузилась — показываем «Warmingtea · Место».
 */
export function usePageTitle(place: string) {
  const user = useAuthStore(s => s.user);
  const location = { lat: user?.locationLat, lon: user?.locationLon, name: user?.location };
  const { data: weather } = useCurrentWeather(location);

  useEffect(() => {
    let prefix = '';
    if (weather) {
      const hour = new Date().getHours();
      const isDay = hour >= 6 && hour < 21;
      const emoji = weatherCodeToEmoji(weather.weatherCode, isDay);
      const temp = `${weather.temp > 0 ? '+' : ''}${weather.temp}°`;
      prefix = `${emoji} ${temp} `;
    }
    document.title = `${prefix}${BRAND} · ${place}`;
  }, [weather, place]);
}

/** Возвращает фирменный статичный заголовок (страницы входа и welcome). */
export function useStaticTitle() {
  useEffect(() => {
    document.title = STATIC_TITLE;
  }, []);
}
