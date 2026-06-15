'use client';

import { useMemo } from 'react';
import { Cloud, CloudRain, Wind, Sun, Droplets, Gauge, Sunrise, Clock } from 'lucide-react';
import { Modal } from '../../../components/ui';
import { useDayWeather, useDayDetail, weatherCodeToInfo, computeBestTimes } from '../../../lib/weather';
import type { WeatherCondition } from '../../../lib/tasks';
import { useAuthStore } from '../../../store/authStore';
import { useWeatherPrefs } from '../../../store/weatherPrefsStore';
import { fmtTemp, fmtWind, fmtPressure } from '../../../lib/weatherUnits';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { Icon, hasIcon } from '../../../lib/icons';
import { HourlyChart } from './HourlyChart';
import { HourlyStrip } from './HourlyStrip';
import { MONTHS_GEN, WEEKDAYS_FULL } from './constants';
import styles from './WeatherDetailModal.module.scss';

const fmtTime = (iso?: string) => (iso ? iso.slice(11, 16) : '—');
const hhmm = (h: number) => `${String(h).padStart(2, '0')}:00`;
const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);

interface Props {
  /** Дата прогноза (YYYY-MM-DD) или null, когда модалка закрыта. */
  date: string | null;
  /** Погодное условие задачи (для «лучшего времени»). */
  condition?: WeatherCondition | null;
  /** У задачи уже задано время? Влияет на текст: «перенести» vs «назначить». */
  hasTime?: boolean;
  /** Назначить/перенести задачу на выбранный час. */
  onPickTime?: (date: string, hour: number) => void;
  onClose: () => void;
}

export function WeatherDetailModal({ date, condition, hasTime, onPickTime, onClose }: Props) {
  const user = useAuthStore(s => s.user);
  const location = { lat: user?.locationLat, lon: user?.locationLon, name: user?.location };
  const { units, metrics: show } = useWeatherPrefs();
  const isMobile = useIsMobile();

  const day = date ?? '';
  const { data: weather, isLoading, isError } = useDayWeather(day, location);
  const { data: detail, isLoading: detailLoading } = useDayDetail(day, location, { enabled: !!day });

  const titleText = (() => {
    if (!day) return 'Прогноз';
    const d = new Date(day + 'T00:00:00');
    return `${WEEKDAYS_FULL[d.getDay()]}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
  })();

  const bestTimes = useMemo(
    () => (detail ? computeBestTimes(detail.hours, condition, 3) : []),
    [detail, condition],
  );

  const { label, icon } = weather ? weatherCodeToInfo(weather.weatherCode) : { label: '', icon: 'Cloud' };

  // Метрики по настройкам пользователя, значения — в выбранных единицах.
  const metricRows: { icon: React.ReactNode; label: string; value: string }[] = [];
  if (weather) {
    if (show.precip) metricRows.push({ icon: <CloudRain size={16} strokeWidth={1.75} />, label: 'Осадки', value: `${weather.precipProbMax}% · ${weather.precipSum} мм` });
    if (show.wind) metricRows.push({ icon: <Wind size={16} strokeWidth={1.75} />, label: 'Ветер', value: fmtWind(weather.windSpeedMax, units.wind) });
    if (show.gusts && detail?.windGustsMax) metricRows.push({ icon: <Wind size={16} strokeWidth={1.75} />, label: 'Порывы', value: fmtWind(detail.windGustsMax, units.wind) });
    if (show.humidity && detail && detail.hours.length) metricRows.push({ icon: <Droplets size={16} strokeWidth={1.75} />, label: 'Влажность', value: `${avg(detail.hours.map(h => h.humidity))}%` });
    if (show.pressure && detail && detail.hours.length) metricRows.push({ icon: <Gauge size={16} strokeWidth={1.75} />, label: 'Давление', value: fmtPressure(avg(detail.hours.map(h => h.pressure)), units.pressure) });
    if (show.uv) metricRows.push({ icon: <Sun size={16} strokeWidth={1.75} />, label: 'УФ-индекс', value: String(detail?.uvIndexMax ?? weather.uvIndex) });
    if (show.sun && detail?.sunrise) metricRows.push({ icon: <Sunrise size={16} strokeWidth={1.75} />, label: 'Восход / закат', value: `${fmtTime(detail.sunrise)} / ${fmtTime(detail.sunset)}` });
  }

  const verb = hasTime ? 'Перенести на' : 'Назначить на';

  return (
    <Modal open={date !== null} onClose={onClose} size="lg" title={titleText}>
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
                ? <Icon name={icon} size={44} strokeWidth={1.4} />
                : <Cloud size={44} strokeWidth={1.4} />}
            </span>
            <div className={styles.heroMain}>
              <span className={styles.heroCond}>{label}</span>
              <div className={styles.heroTemps}>
                <span className={styles.heroTempMax}>{fmtTemp(weather.tempMax, units.temp)}</span>
                <span className={styles.heroTempMin}>{fmtTemp(weather.tempMin, units.temp)}</span>
              </div>
              <span className={styles.heroFeels}>ощущается {fmtTemp(weather.feelsLikeMax, units.temp)}</span>
            </div>
          </div>

          {/* «Лучшее время» + назначение/перенос */}
          {onPickTime && bestTimes.length > 0 && (
            <div className={styles.best}>
              <Clock size={16} strokeWidth={1.75} />
              <div className={styles.bestBody}>
                <span className={styles.bestTitle}>Лучшее время · {bestTimes[0].reason}</span>
                <div className={styles.bestChips}>
                  <span className={styles.bestVerb}>{verb}</span>
                  {bestTimes.map(t => (
                    <button key={t.bestHour} type="button" className={styles.chip} onClick={() => onPickTime(day, t.bestHour)}>
                      {hhmm(t.bestHour)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Метрики (по настройкам, в выбранных единицах) */}
          {metricRows.length > 0 && (
            <div className={styles.metrics}>
              {metricRows.map((m, i) => (
                <div key={i} className={styles.metric}>
                  <span className={styles.metricIcon}>{m.icon}</span>
                  <span className={styles.metricLabel}>{m.label}</span>
                  <span className={styles.metricValue}>{m.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Почасовой прогноз: лента (телефон) / SVG-график (ПК) */}
          {detailLoading ? (
            <div className={styles.chartSkeleton} aria-hidden="true" />
          ) : detail && detail.hours.length > 1 ? (
            isMobile ? (
              <HourlyStrip hours={detail.hours} highlightHours={bestTimes.map(t => t.bestHour)} />
            ) : (
              <HourlyChart hours={detail.hours} highlight={bestTimes[0] ? { startHour: bestTimes[0].startHour, endHour: bestTimes[0].endHour } : undefined} />
            )
          ) : (
            <div className={styles.chartPlaceholder}>Почасовой прогноз недоступен</div>
          )}
        </div>
      )}
    </Modal>
  );
}
