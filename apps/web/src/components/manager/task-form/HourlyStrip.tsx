'use client';

import { Cloud } from 'lucide-react';
import { weatherCodeToInfo, type HourlyPoint } from '../../../lib/weather';
import { Icon, hasIcon } from '../../../lib/icons';
import { useWeatherPrefs } from '../../../store/weatherPrefsStore';
import { fmtTemp } from '../../../lib/weatherUnits';
import styles from './HourlyStrip.module.scss';

interface Props {
  hours: HourlyPoint[];
  /** Часы «лучшего времени» — подсвечиваются. */
  highlightHours?: number[];
}

// Телефонный вариант почасового прогноза: горизонтальная лента плиток
// (время · иконка · вероятность осадков · температура), как в нативных погодниках.
export function HourlyStrip({ hours, highlightHours }: Props) {
  const tempUnit = useWeatherPrefs(s => s.units.temp);
  const hi = new Set(highlightHours ?? []);

  return (
    <div className={styles.strip} role="list" aria-label="Почасовой прогноз">
      {hours.map(h => {
        const { icon } = weatherCodeToInfo(h.weatherCode);
        const cls = [
          styles.tile,
          hi.has(h.hour) && styles.tileBest,
          !h.isDay && styles.tileNight,
        ].filter(Boolean).join(' ');
        return (
          <div key={h.time} role="listitem" className={cls}>
            <span className={styles.time}>{String(h.hour).padStart(2, '0')}:00</span>
            <span className={styles.icon}>
              {hasIcon(icon)
                ? <Icon name={icon} size={22} strokeWidth={1.5} />
                : <Cloud size={22} strokeWidth={1.5} />}
            </span>
            <span className={styles.prob}>{h.precipProb != null && h.precipProb > 0 ? `${h.precipProb}%` : ''}</span>
            <span className={styles.temp}>{fmtTemp(h.temp, tempUnit)}</span>
          </div>
        );
      })}
    </div>
  );
}
