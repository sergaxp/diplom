'use client';

import { useMemo } from 'react';
import { DayCount } from '../../../lib/activity';
import { buildHeatmap, formatCellDate } from '../../../lib/heatmap';
import styles from './HeatmapGrid.module.scss';

interface Props {
  days: DayCount[];
  /** Сколько недель показывать (по умолчанию 53 — как у GitHub). */
  weeks?: number;
  /** Подпись над сеткой (напр. «N действий за год»). */
  caption?: string;
}

/** Метки строк (пн..вс); показываем только пн/ср/пт — как у GitHub. */
const WEEKDAY_LABELS = ['Пн', '', 'Ср', '', 'Пт', '', ''];

/**
 * Презентационная GitHub-style сетка активности. Данные (клетки по дням)
 * приходят готовыми — компонент переиспользуется и для проекта, и для профиля.
 */
export function HeatmapGrid({ days, weeks = 53, caption }: Props) {
  const model = useMemo(() => buildHeatmap(days, { weeks }), [days, weeks]);

  return (
    <div className={styles.root}>
      {caption !== undefined && (
        <div className={styles.caption}>
          {caption || `${model.total} действий за год`}
        </div>
      )}

      <div className={styles.scroll}>
        <div className={styles.grid}>
          {/* Метки месяцев */}
          <div className={styles.monthsRow}>
            <span className={styles.weekdaySpacer} />
            {model.monthLabels.map((m, i) => (
              <span key={i} className={styles.month}>
                {m}
              </span>
            ))}
          </div>

          <div className={styles.body}>
            {/* Метки дней недели */}
            <div className={styles.weekdays}>
              {WEEKDAY_LABELS.map((d, i) => (
                <span key={i} className={styles.weekday}>
                  {d}
                </span>
              ))}
            </div>

            {/* Столбцы-недели */}
            <div className={styles.weeks}>
              {model.weeks.map((week, wi) => (
                <div key={wi} className={styles.week}>
                  {week.map((cell, di) =>
                    cell.date ? (
                      <span
                        key={di}
                        className={`${styles.cell} ${styles[`lvl${cell.level}`]}`}
                        title={`${formatCellDate(cell.date)}: ${cell.count} ${plural(cell.count)}`}
                      />
                    ) : (
                      <span key={di} className={`${styles.cell} ${styles.empty}`} />
                    ),
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Легенда */}
          <div className={styles.legend}>
            <span>меньше</span>
            {[0, 1, 2, 3, 4].map((l) => (
              <span key={l} className={`${styles.cell} ${styles[`lvl${l}`]}`} />
            ))}
            <span>больше</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function plural(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'действие';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'действия';
  return 'действий';
}
