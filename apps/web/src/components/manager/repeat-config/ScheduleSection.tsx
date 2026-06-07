'use client';

import { WEEKDAYS, UNIT_OPTS, unitLabel } from '../../../lib/repeatConfig';
import type { UseRepeatConfigResult } from '../../../hooks/useRepeatConfig';
import styles from './RepeatConfigModal.module.scss';

interface Props {
  r: UseRepeatConfigResult;
  multiDay: boolean;
}

export function ScheduleSection({ r, multiDay }: Props) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>Расписание</div>

      {/* Переключатель режима */}
      <div className={styles.modeTabs}>
        <button
          type="button"
          className={`${styles.modeTab} ${r.mode === 'interval' ? styles.modeTabActive : ''}`}
          onClick={() => r.setMode('interval')}
        >
          По интервалу
        </button>
        <button
          type="button"
          className={`${styles.modeTab} ${r.mode === 'cyclic' ? styles.modeTabActive : ''} ${multiDay ? styles.modeTabDisabled : ''}`}
          onClick={() => !multiDay && r.setMode('cyclic')}
          disabled={multiDay}
          title={multiDay ? 'Недоступно для многодневных задач' : ''}
        >
          Циклический
        </button>
        <button
          type="button"
          className={`${styles.modeTab} ${r.mode === 'dependency' ? styles.modeTabActive : ''} ${multiDay ? styles.modeTabDisabled : ''}`}
          onClick={() => !multiDay && r.setMode('dependency')}
          disabled={multiDay}
          title={multiDay ? 'Недоступно для многодневных задач' : ''}
        >
          После выполнения
        </button>
        <button
          type="button"
          className={`${styles.modeTab} ${r.mode === 'monthdays' ? styles.modeTabActive : ''} ${multiDay ? styles.modeTabDisabled : ''}`}
          onClick={() => !multiDay && r.setMode('monthdays')}
          disabled={multiDay}
          title={multiDay ? 'Недоступно для многодневных задач' : ''}
        >
          По дням месяца
        </button>
      </div>

      {multiDay && (
        <div className={styles.warnBanner}>
          Многодневный режим: доступен только интервальный повтор.
          Циклический и «после выполнения» работают с одиночными задачами.
        </div>
      )}

      {/* ── Интервальный ── */}
      {r.mode === 'interval' && (
        <div className={styles.intervalBlock}>
          <div className={styles.everyRow}>
            <span className={styles.everyPrefix}>Каждые</span>
            <input
              className={styles.everyInput}
              type="number"
              min={r.currentMinEvery}
              max={365}
              value={r.every}
              onChange={e => r.onEveryChange(e.target.value)}
              title={multiDay && r.currentMinEvery > 1 ? `Минимум ${r.currentMinEvery} – чтобы вхождения не накладывались на длительность задачи` : ''}
            />
            <div className={styles.unitBtns}>
              {UNIT_OPTS.map(u => (
                <button
                  key={u.v}
                  type="button"
                  className={`${styles.unitBtn} ${r.unit === u.v ? styles.unitBtnActive : ''}`}
                  onClick={() => r.selectUnit(u.v)}
                >
                  {unitLabel(u.v, r.every)}
                </button>
              ))}
            </div>
          </div>
          {multiDay && r.currentMinEvery > 1 && (
            <div className={styles.minEveryHint}>
              Минимум для многодневной задачи – {r.currentMinEvery} {unitLabel(r.unit, r.currentMinEvery)}
            </div>
          )}

          {r.unit === 'week' && !multiDay && (
            <div className={styles.wdRow}>
              {WEEKDAYS.map(({ v, s }) => (
                <button
                  key={v}
                  type="button"
                  className={`${styles.wdBtn} ${r.weekdays.includes(v) ? styles.wdBtnActive : ''}`}
                  onClick={() => r.toggleWeekday(v)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {r.unit !== 'week' && (
            <label className={styles.checkRow}>
              <input type="checkbox" checked={r.skipWeekends} onChange={e => r.setSkipWeekends(e.target.checked)} />
              Пропускать субботу и воскресенье
            </label>
          )}
        </div>
      )}

      {/* ── Цикличный ── */}
      {r.mode === 'cyclic' && !multiDay && (
        <div className={styles.cyclicBlock}>
          <div className={styles.cyclicHint}>
            Задайте паттерн: сколько дней задача активна, затем сколько дней отдыха – и так по кругу.
          </div>
          <div className={styles.cyclicRows}>
            {r.cyclicPattern.map((seg, idx) => (
              <div key={idx} className={styles.cyclicRow}>
                <span className={styles.cyclicIndex}>{idx + 1}</span>
                <div className={styles.cyclicField}>
                  <input
                    className={styles.cyclicInput}
                    type="number"
                    min={0}
                    max={365}
                    value={seg.active}
                    onChange={e => r.updateCyclic(idx, 'active', parseInt(e.target.value) || 0)}
                  />
                  <span className={styles.cyclicFieldLabel}>дн. задач</span>
                </div>
                <span className={styles.cyclicArrow}>→</span>
                <div className={styles.cyclicField}>
                  <input
                    className={styles.cyclicInput}
                    type="number"
                    min={0}
                    max={365}
                    value={seg.rest}
                    onChange={e => r.updateCyclic(idx, 'rest', parseInt(e.target.value) || 0)}
                  />
                  <span className={styles.cyclicFieldLabel}>дн. отдыха</span>
                </div>
                <button
                  type="button"
                  className={styles.cyclicRemoveBtn}
                  onClick={() => r.removeCyclicSegment(idx)}
                  disabled={r.cyclicPattern.length <= 1}
                  title="Удалить период"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button type="button" className={styles.cyclicAddBtn} onClick={r.addCyclicSegment}>
            + Добавить период
          </button>
          {r.cyclicPreview && (
            <div className={styles.cyclicPreview}>{r.cyclicPreview}</div>
          )}
        </div>
      )}

      {/* ── После выполнения ── */}
      {r.mode === 'dependency' && !multiDay && (
        <div className={styles.depBlock}>
          <div className={styles.depHint}>
            Задача появится снова через указанное число дней <b>после её выполнения</b>.
            Если не выполнена – будет висеть до выполнения.
          </div>
          <div className={styles.depRow}>
            <span className={styles.depLabel}>Через</span>
            <input
              className={styles.depInput}
              type="number"
              min={1}
              max={365}
              value={r.dependencyDays}
              onChange={e => r.setDependencyDays(Math.max(1, parseInt(e.target.value) || 1))}
            />
            <span className={styles.depLabel}>{unitLabel('day', r.dependencyDays)} после выполнения</span>
          </div>
        </div>
      )}

      {/* ── По дням месяца ── */}
      {r.mode === 'monthdays' && !multiDay && (
        <div className={styles.monthDaysBlock}>
          <div className={styles.depHint}>
            Задача будет повторяться в выбранные числа каждого месяца.
          </div>
          <div className={styles.monthDaysGrid}>
            {Array.from({ length: r.daysInSelMonth }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                type="button"
                className={`${styles.monthChip} ${r.monthDays.includes(n) ? styles.monthChipActive : ''}`}
                onClick={() => r.toggleMonthDay(n)}
              >
                {n}
              </button>
            ))}
          </div>
          {r.monthDays.length > 0 && (
            <div className={styles.seasonRow}>
              <button type="button" className={styles.seasonClearBtn} onClick={() => r.setMonthDays([])}>
                Очистить
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
