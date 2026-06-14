'use client';

import { useEffect, useMemo, useState } from 'react';
import { Cloud, CloudRain, Wind, Sun, Droplets, Gauge, Sunrise, Sunset, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { Modal } from '../../../components/ui';
import { useDayWeather, useDayDetail, weatherCodeToInfo, computeBestWindow } from '../../../lib/weather';
import { toDateStr, type WeatherCondition } from '../../../lib/tasks';
import { useAuthStore } from '../../../store/authStore';
import { Icon, hasIcon } from '../../../lib/icons';
import { HourlyChart } from './HourlyChart';
import { MONTHS_GEN, WEEKDAYS_FULL } from './constants';
import styles from './WeatherDetailModal.module.scss';

const fmt = (t: number) => `${t > 0 ? '+' : ''}${t}`;
const fmtTime = (iso?: string) => (iso ? iso.slice(11, 16) : '—');
const hhmm = (h: number) => `${String(h).padStart(2, '0')}:00`;
const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);

// Горизонт навигации по дням относительно сегодня.
const NAV_MIN = -30;
const NAV_MAX = 15;

interface Props {
  /** Дата прогноза (YYYY-MM-DD) или null, когда модалка закрыта. */
  date: string | null;
  /** Погодное условие задачи (для «лучшего времени»). */
  condition?: WeatherCondition | null;
  /** Перенести задачу на выбранный день+час. */
  onPickTime?: (date: string, hour: number) => void;
  onClose: () => void;
}

export function WeatherDetailModal({ date, condition, onPickTime, onClose }: Props) {
  const user = useAuthStore(s => s.user);
  const location = { lat: user?.locationLat, lon: user?.locationLon, name: user?.location };

  // Просматриваемый день: открывается на дате карточки, листается ←/→.
  const [viewDate, setViewDate] = useState<string | null>(date);
  useEffect(() => { if (date) setViewDate(date); }, [date]);
  const day = viewDate ?? date ?? '';

  const { data: weather, isLoading, isError } = useDayWeather(day, location);
  const { data: detail, isLoading: detailLoading } = useDayDetail(day, location, { enabled: !!day });

  const daysDiff = useMemo(() => {
    if (!day) return 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.round((new Date(day + 'T00:00:00').getTime() - today.getTime()) / 86_400_000);
  }, [day]);

  const shiftDay = (delta: number) => {
    const d = new Date(day + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    setViewDate(toDateStr(d));
  };

  const titleText = (() => {
    if (!day) return 'Прогноз';
    const d = new Date(day + 'T00:00:00');
    return `${WEEKDAYS_FULL[d.getDay()]}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
  })();

  const best = useMemo(
    () => (detail ? computeBestWindow(detail.hours, condition) : null),
    [detail, condition],
  );

  const { label, icon } = weather ? weatherCodeToInfo(weather.weatherCode) : { label: '', icon: 'Cloud' };

  const header = (
    <div className={styles.navHeader}>
      <button type="button" className={styles.navBtn} aria-label="Предыдущий день"
        disabled={daysDiff <= NAV_MIN} onClick={() => shiftDay(-1)}>
        <ChevronLeft size={18} />
      </button>
      <h2 className={styles.navTitle}>{titleText}</h2>
      <button type="button" className={styles.navBtn} aria-label="Следующий день"
        disabled={daysDiff >= NAV_MAX} onClick={() => shiftDay(1)}>
        <ChevronRight size={18} />
      </button>
    </div>
  );

  return (
    <Modal open={date !== null} onClose={onClose} size="lg" header={header}>
      {isLoading ? (
        <div className={styles.note}>Загрузка прогноза…</div>
      ) : isError || !weather ? (
        <div className={styles.note}>Не удалось загрузить подробный прогноз</div>
      ) : (
        <div className={styles.body}>
          {/* Шапка: иконка + состояние + температуры */}
          <div className={styles.hero}>
            <span className={styles.heroIcon}>
              {hasIcon(icon)
                ? <Icon name={icon} size={48} strokeWidth={1.4} />
                : <Cloud size={48} strokeWidth={1.4} />}
            </span>
            <div className={styles.heroMain}>
              <span className={styles.heroCond}>{label}</span>
              <div className={styles.heroTemps}>
                <span className={styles.heroTempMax}>{fmt(weather.tempMax)}°</span>
                <span className={styles.heroTempMin}>{fmt(weather.tempMin)}°</span>
              </div>
              <span className={styles.heroFeels}>ощущается {fmt(weather.feelsLikeMax)}°</span>
            </div>
          </div>

          {/* «Лучшее время» + перенос задачи */}
          {best && onPickTime && (
            <div className={styles.best}>
              <Clock size={16} strokeWidth={1.75} />
              <div className={styles.bestText}>
                <span className={styles.bestTitle}>Лучшее время: {hhmm(best.startHour)}–{hhmm(best.endHour)}</span>
                <span className={styles.bestReason}>{best.reason}</span>
              </div>
              <button type="button" className={styles.bestBtn} onClick={() => onPickTime(day, best.bestHour)}>
                Перенести на {hhmm(best.bestHour)}
              </button>
            </div>
          )}

          {/* Метрики */}
          <div className={styles.metrics}>
            <Metric icon={<CloudRain size={16} strokeWidth={1.75} />} label="Осадки"
              value={`${weather.precipProbMax}% · ${weather.precipSum} мм`} />
            <Metric icon={<Wind size={16} strokeWidth={1.75} />} label="Ветер"
              value={`${weather.windSpeedMax} км/ч${detail?.windGustsMax ? ` · порывы ${detail.windGustsMax}` : ''}`} />
            <Metric icon={<Sun size={16} strokeWidth={1.75} />} label="УФ-индекс"
              value={String(detail?.uvIndexMax ?? weather.uvIndex)} />
            {detail && detail.hours.length > 0 && (
              <>
                <Metric icon={<Droplets size={16} strokeWidth={1.75} />} label="Влажность"
                  value={`${avg(detail.hours.map(h => h.humidity))}%`} />
                <Metric icon={<Gauge size={16} strokeWidth={1.75} />} label="Давление"
                  value={`${avg(detail.hours.map(h => h.pressure))} гПа`} />
              </>
            )}
            {detail?.sunrise && (
              <Metric icon={<Sunrise size={16} strokeWidth={1.75} />} label="Восход"
                value={fmtTime(detail.sunrise)} />
            )}
            {detail?.sunset && (
              <Metric icon={<Sunset size={16} strokeWidth={1.75} />} label="Закат"
                value={fmtTime(detail.sunset)} />
            )}
          </div>

          {/* Почасовой график */}
          {detailLoading ? (
            <div className={styles.chartSkeleton} aria-hidden="true" />
          ) : detail && detail.hours.length > 1 ? (
            <HourlyChart hours={detail.hours} highlight={best ? { startHour: best.startHour, endHour: best.endHour } : undefined} />
          ) : (
            <div className={styles.chartPlaceholder}>Почасовой прогноз недоступен</div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricIcon}>{icon}</span>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue}>{value}</span>
    </div>
  );
}
