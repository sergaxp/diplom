'use client';

import { Cloud, Wind, Thermometer, CloudRain } from 'lucide-react';
import { useDayWeather, weatherCodeToInfo } from '../../../lib/weather';
import { useAuthStore } from '../../../store/authStore';
import { Icon, hasIcon } from '../../../lib/icons';
import { MONTHS_GEN } from './constants';
import styles from './TaskFormModal.module.scss';

export function WeatherWidget({ date }: { date: string }) {
  const user = useAuthStore(s => s.user);
  const location = { lat: user?.locationLat, lon: user?.locationLon, name: user?.location };
  const { data: weather, isLoading, isError } = useDayWeather(date, location);

  const today      = new Date(); today.setHours(0, 0, 0, 0);
  const targetDate = new Date(date + 'T00:00:00');
  const daysDiff   = Math.round((targetDate.getTime() - today.getTime()) / 86_400_000);

  const dateLabel = (() => {
    if (daysDiff === 0) return 'Сегодня';
    if (daysDiff === 1) return 'Завтра';
    if (daysDiff === -1) return 'Вчера';
    const d = new Date(date + 'T00:00:00');
    return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
  })();

  if (daysDiff > 15) {
    return (
      <div className={styles.weatherCard}>
        <div className={styles.weatherHeader}>
          <Cloud size={18} strokeWidth={1.5} />
          <span className={styles.weatherTitle}>{dateLabel}</span>
        </div>
        <p className={styles.weatherNote}>Прогноз доступен только на 16 дней вперёд</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.weatherCard}>
        <div className={styles.weatherHeader}>
          <Cloud size={18} strokeWidth={1.5} />
          <span className={styles.weatherTitle}>{dateLabel}</span>
        </div>
        <p className={styles.weatherNote}>Загрузка прогноза...</p>
      </div>
    );
  }

  if (isError || !weather) {
    return (
      <div className={styles.weatherCard}>
        <div className={styles.weatherHeader}>
          <Cloud size={18} strokeWidth={1.5} />
          <span className={styles.weatherTitle}>{dateLabel}</span>
        </div>
        <p className={styles.weatherNote}>
          {isError ? 'Не удалось загрузить прогноз' : 'Прогноз на этот день пока недоступен'}
        </p>
      </div>
    );
  }

  const { label, icon } = weatherCodeToInfo(weather.weatherCode);

  return (
    <div className={styles.weatherCard}>
      <div className={styles.weatherHeader}>
        {hasIcon(icon) ? <Icon name={icon} size={20} strokeWidth={1.5} /> : <Cloud size={20} strokeWidth={1.5} />}
        <span className={styles.weatherTitle}>{dateLabel}</span>
        <span className={styles.weatherCondition}>{label}</span>
      </div>

      <div className={styles.weatherTemps}>
        <span className={styles.weatherTempMax}>{weather.tempMax > 0 ? '+' : ''}{weather.tempMax}°</span>
        <span className={styles.weatherTempMin}>{weather.tempMin > 0 ? '+' : ''}{weather.tempMin}°</span>
      </div>

      <div className={styles.weatherRows}>
        <div className={styles.weatherRow}>
          <Thermometer size={12} strokeWidth={1.75} />
          <span>Ощущается</span>
          <span className={styles.weatherRowVal}>
            {weather.feelsLikeMax > 0 ? '+' : ''}{weather.feelsLikeMax}°
          </span>
        </div>
        <div className={styles.weatherRow}>
          <CloudRain size={12} strokeWidth={1.75} />
          <span>Осадки</span>
          <span className={styles.weatherRowVal}>
            {weather.precipProbMax}% · {weather.precipSum} мм
          </span>
        </div>
        <div className={styles.weatherRow}>
          <Wind size={12} strokeWidth={1.75} />
          <span>Ветер</span>
          <span className={styles.weatherRowVal}>{weather.windSpeedMax} км/ч</span>
        </div>
      </div>
    </div>
  );
}
