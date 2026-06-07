'use client';

import { MONTHS_SHORT, SEASONS } from '../../../lib/repeatConfig';
import type { UseRepeatConfigResult } from '../../../hooks/useRepeatConfig';
import styles from './RepeatConfigModal.module.scss';

interface Props {
  r: UseRepeatConfigResult;
  multiDay: boolean;
}

export function ConditionsSection({ r, multiDay }: Props) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>Условия</div>

      {/* Conflict #4: scope для многодневных */}
      {multiDay && (
        <div className={styles.scopeBlock}>
          <div className={styles.scopeLabel}>Применять условия к:</div>
          <div className={styles.scopeOpts}>
            <label className={styles.scopeOpt}>
              <input
                type="radio"
                name="condScope"
                checked={r.conditionScope === 'perDay'}
                onChange={() => r.setConditionScope('perDay')}
              />
              каждому дню (с пропусками)
            </label>
            <label className={styles.scopeOpt}>
              <input
                type="radio"
                name="condScope"
                checked={r.conditionScope === 'whole'}
                onChange={() => r.setConditionScope('whole')}
              />
              всему блоку (без пропусков)
            </label>
          </div>
        </div>
      )}

      {/* Сезонность */}
      <div className={styles.condBlock}>
        <label className={styles.condToggle}>
          <input
            type="checkbox"
            checked={r.useSeasonal}
            onChange={e => r.setUseSeasonal(e.target.checked)}
          />
          <span className={styles.condToggleLabel}>Сезонность (только в выбранные месяцы)</span>
        </label>
        {r.useSeasonal && (
          <div className={styles.condOptions}>
            <div className={styles.monthsGrid}>
              {MONTHS_SHORT.map((m, i) => (
                <button
                  key={i}
                  type="button"
                  className={`${styles.monthChip} ${r.months.includes(i + 1) ? styles.monthChipActive : ''}`}
                  onClick={() => r.toggleMonth(i + 1)}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className={styles.seasonRow}>
              {SEASONS.map(s => (
                <button
                  key={s.label}
                  type="button"
                  className={styles.seasonBtn}
                  onClick={() => r.setSeasonMonths(s.months)}
                >
                  {s.label}
                </button>
              ))}
              <button type="button" className={styles.seasonClearBtn} onClick={r.clearMonths}>
                Очистить
              </button>
            </div>
            {r.months.length > 0 && r.months.length < 12 && (
              <div className={styles.condNote}>
                Активна {r.months.length === 1 ? 'в' : 'в'}{' '}
                {r.months.map(m => MONTHS_SHORT[m - 1]).join(', ')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Праздники */}
      <div className={styles.condBlock}>
        <label className={styles.condToggle}>
          <input
            type="checkbox"
            checked={r.useHolidays}
            onChange={e => r.setUseHolidays(e.target.checked)}
          />
          <span className={styles.condToggleLabel}>Учитывать праздники</span>
        </label>
        {r.useHolidays && (
          <div className={styles.condOptions}>
            <label className={styles.radioRow}>
              <input
                type="radio"
                name="holidayMode"
                checked={!r.onlyOnHolidays}
                onChange={() => { r.setSkipHolidays(true); r.setOnlyOnHolidays(false); }}
              />
              Пропускать государственные праздники
            </label>
            <label className={styles.radioRow}>
              <input
                type="radio"
                name="holidayMode"
                checked={r.onlyOnHolidays}
                onChange={() => { r.setOnlyOnHolidays(true); r.setSkipHolidays(false); }}
              />
              Только в праздничные дни
            </label>
          </div>
        )}
      </div>

      {/* Погода */}
      <div className={styles.condBlock}>
        <label className={styles.condToggle}>
          <input
            type="checkbox"
            checked={r.useWeather}
            onChange={e => r.setUseWeather(e.target.checked)}
          />
          <span className={styles.condToggleLabel}>Учитывать погоду</span>
        </label>
        {r.useWeather && (
          <div className={styles.condOptions}>
            <div className={styles.weatherNote}>
              Прогноз доступен до 16 дней вперёд. На более поздние даты задача будет показана.
            </div>
            <div className={styles.condSubLabel}>Пропускать при:</div>
            <div className={styles.weatherSkipRow}>
              <label className={styles.weatherChip}>
                <input type="checkbox" checked={r.skipRain} onChange={e => r.setSkipRain(e.target.checked)} />
                🌧 Дождь
              </label>
              <label className={styles.weatherChip}>
                <input type="checkbox" checked={r.skipSnow} onChange={e => r.setSkipSnow(e.target.checked)} />
                🌨 Снег
              </label>
              <label className={styles.weatherChip}>
                <input type="checkbox" checked={r.skipStorm} onChange={e => r.setSkipStorm(e.target.checked)} />
                ⛈ Гроза
              </label>
              <label className={styles.weatherChip}>
                <input type="checkbox" checked={r.skipFog} onChange={e => r.setSkipFog(e.target.checked)} />
                🌫 Туман
              </label>
              <label className={styles.weatherChip}>
                <input type="checkbox" checked={r.skipCloudy} onChange={e => r.setSkipCloudy(e.target.checked)} />
                ☁️ Пасмурно
              </label>
            </div>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={r.requireClear} onChange={e => r.setRequireClear(e.target.checked)} />
              Только в ясную погоду
            </label>
            <div className={styles.condSubLabel}>Температура днём (°C):</div>
            <div className={styles.tempRow}>
              <span className={styles.tempLabel}>от</span>
              <input
                className={styles.tempInput}
                type="number"
                placeholder="–"
                value={r.minTempDay}
                onChange={e => r.setMinTempDay(e.target.value)}
              />
              <span className={styles.tempLabel}>до</span>
              <input
                className={styles.tempInput}
                type="number"
                placeholder="–"
                value={r.maxTempDay}
                onChange={e => r.setMaxTempDay(e.target.value)}
              />
              <span className={styles.tempLabel}>°C</span>
            </div>
            <div className={styles.condSubLabel}>Температура ночью (°C):</div>
            <div className={styles.tempRow}>
              <span className={styles.tempLabel}>от</span>
              <input
                className={styles.tempInput}
                type="number"
                placeholder="–"
                value={r.minTempNight}
                onChange={e => r.setMinTempNight(e.target.value)}
              />
              <span className={styles.tempLabel}>до</span>
              <input
                className={styles.tempInput}
                type="number"
                placeholder="–"
                value={r.maxTempNight}
                onChange={e => r.setMaxTempNight(e.target.value)}
              />
              <span className={styles.tempLabel}>°C</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
