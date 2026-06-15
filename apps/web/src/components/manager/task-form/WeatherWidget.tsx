'use client';

import { Cloud, Wind, Thermometer, CloudRain, ChevronRight } from 'lucide-react';
import { useDayWeather, weatherCodeToInfo } from '../../../lib/weather';
import { useAuthStore } from '../../../store/authStore';
import { useWeatherPrefs } from '../../../store/weatherPrefsStore';
import { fmtTemp, fmtWind } from '../../../lib/weatherUnits';
import { Icon, hasIcon } from '../../../lib/icons';
import { MONTHS_GEN } from './constants';
import styles from './TaskFormModal.module.scss';

interface WeatherWidgetProps {
  date: string;
  /** full — десктопная развёрнутая карточка; compact — мобильная строка. */
  variant?: 'full' | 'compact';
  /** Если задан — карточка кликабельна и открывает подробный прогноз. */
  onOpenDetail?: (date: string) => void;
}

export function WeatherWidget({ date, variant = 'full', onOpenDetail }: WeatherWidgetProps) {
  const user = useAuthStore(s => s.user);
  const location = { lat: user?.locationLat, lon: user?.locationLon, name: user?.location };
  const units = useWeatherPrefs(s => s.units);
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

  // Состояния без данных: показываем заметку, карточка не кликается.
  const note =
    daysDiff > 15 ? 'Прогноз доступен только на 16 дней вперёд'
    : isLoading   ? 'Загрузка прогноза...'
    : isError     ? 'Не удалось загрузить прогноз'
    : !weather    ? 'Прогноз на этот день пока недоступен'
    : null;

  if (note || !weather) {
    if (variant === 'compact') {
      return (
        <div className={styles.weatherCompact}>
          <span className={styles.weatherCompactIcon}><Cloud size={20} strokeWidth={1.5} /></span>
          <span className={styles.weatherCompactDay}>{dateLabel}</span>
          <span className={styles.weatherNote}>{note}</span>
        </div>
      );
    }
    return (
      <div className={styles.weatherCard}>
        <div className={styles.weatherHeader}>
          <Cloud size={18} strokeWidth={1.5} />
          <span className={styles.weatherTitle}>{dateLabel}</span>
        </div>
        <p className={styles.weatherNote}>{note}</p>
      </div>
    );
  }

  const { label, icon } = weatherCodeToInfo(weather.weatherCode);

  const content = variant === 'compact' ? (
    <>
      <span className={styles.weatherCompactIcon}>
        {hasIcon(icon) ? <Icon name={icon} size={22} strokeWidth={1.5} /> : <Cloud size={22} strokeWidth={1.5} />}
        <span className={styles.weatherCompactCond}>{label}</span>
      </span>
      <span className={styles.weatherCompactDay}>{dateLabel}</span>
      <span className={styles.weatherCompactTemps}>
        <b>{fmtTemp(weather.tempMax, units.temp)}</b>
        <span className={styles.weatherCompactMin}>{fmtTemp(weather.tempMin, units.temp)}</span>
      </span>
      <span className={styles.weatherCompactFeels}>ощущается {fmtTemp(weather.feelsLikeMax, units.temp)}</span>
      {onOpenDetail && <ChevronRight size={16} className={styles.weatherChevron} />}
    </>
  ) : (
    <>
      <div className={styles.weatherHeader}>
        {hasIcon(icon) ? <Icon name={icon} size={20} strokeWidth={1.5} /> : <Cloud size={20} strokeWidth={1.5} />}
        <span className={styles.weatherTitle}>{dateLabel}</span>
        <span className={styles.weatherCondition}>{label}</span>
        {onOpenDetail && <ChevronRight size={16} className={styles.weatherChevron} />}
      </div>

      <div className={styles.weatherTemps}>
        <span className={styles.weatherTempMax}>{fmtTemp(weather.tempMax, units.temp)}</span>
        <span className={styles.weatherTempMin}>{fmtTemp(weather.tempMin, units.temp)}</span>
      </div>

      <div className={styles.weatherRows}>
        <div className={styles.weatherRow}>
          <Thermometer size={12} strokeWidth={1.75} />
          <span>Ощущается</span>
          <span className={styles.weatherRowVal}>{fmtTemp(weather.feelsLikeMax, units.temp)}</span>
        </div>
        <div className={styles.weatherRow}>
          <CloudRain size={12} strokeWidth={1.75} />
          <span>Осадки</span>
          <span className={styles.weatherRowVal}>{weather.precipProbMax}% · {weather.precipSum} мм</span>
        </div>
        <div className={styles.weatherRow}>
          <Wind size={12} strokeWidth={1.75} />
          <span>Ветер</span>
          <span className={styles.weatherRowVal}>{fmtWind(weather.windSpeedMax, units.wind)}</span>
        </div>
      </div>
    </>
  );

  const cls = variant === 'compact' ? styles.weatherCompact : styles.weatherCard;

  if (onOpenDetail) {
    return (
      <button
        type="button"
        className={`${cls} ${styles.weatherClickable}`}
        onClick={() => onOpenDetail(date)}
        aria-label={`Подробный прогноз: ${dateLabel}, ${label}`}
      >
        {content}
      </button>
    );
  }

  return <div className={cls}>{content}</div>;
}
