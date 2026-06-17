import { DayCount } from './activity';

/** Одна клетка heatmap. `date===null` — паддинг до начала недели (пустая ячейка). */
export interface HeatmapCell {
  date: string | null; // YYYY-MM-DD
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface HeatmapModel {
  /** Столбцы-недели (слева направо), в каждой 7 ячеек (пн..вс сверху вниз). */
  weeks: HeatmapCell[][];
  /** Подпись месяца над столбцом (или '' если не первый столбец месяца). */
  monthLabels: string[];
  total: number;
  maxCount: number;
}

const MONTHS_RU = [
  'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
  'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек',
];

const DAY_MS = 24 * 60 * 60 * 1000;

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/** Индекс дня недели с понедельника (пн=0 … вс=6). */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function levelFor(count: number, max: number): HeatmapCell['level'] {
  if (count <= 0) return 0;
  if (max <= 0) return 1;
  const q = count / max;
  if (q <= 0.25) return 1;
  if (q <= 0.5) return 2;
  if (q <= 0.75) return 3;
  return 4;
}

/**
 * Строит GitHub-style сетку за последние ~год, заканчивая сегодняшним днём.
 * Сетка выровнена по неделям (столбец = неделя пн..вс); ведущие дни первой
 * недели до старта — пустые паддинг-ячейки.
 */
export function buildHeatmap(
  days: DayCount[],
  opts: { weeks?: number; today?: Date } = {},
): HeatmapModel {
  const weeksCount = opts.weeks ?? 53;
  const today = opts.today ? new Date(opts.today) : new Date();
  today.setHours(0, 0, 0, 0);

  const counts = new Map<string, number>();
  for (const d of days) counts.set(d.date, (counts.get(d.date) ?? 0) + d.count);
  const maxCount = days.reduce((m, d) => Math.max(m, d.count), 0);

  // Старт сетки = понедельник недели, отстоящей на (weeksCount-1) недель назад.
  const gridStart = new Date(today.getTime() - mondayIndex(today) * DAY_MS);
  gridStart.setTime(gridStart.getTime() - (weeksCount - 1) * 7 * DAY_MS);

  const weeks: HeatmapCell[][] = [];
  const monthLabels: string[] = [];
  let total = 0;
  let prevMonth = -1;

  for (let w = 0; w < weeksCount; w++) {
    const week: HeatmapCell[] = [];
    let labelForColumn = '';
    for (let dRow = 0; dRow < 7; dRow++) {
      const cur = new Date(gridStart.getTime() + (w * 7 + dRow) * DAY_MS);
      cur.setHours(0, 0, 0, 0);
      if (cur > today) {
        week.push({ date: null, count: 0, level: 0 });
        continue;
      }
      const key = ymd(cur);
      const count = counts.get(key) ?? 0;
      total += count;
      week.push({ date: key, count, level: levelFor(count, maxCount) });
      // Месяц подписываем у столбца, где появляется новый месяц (по 1-му дню недели).
      if (dRow === 0 && cur.getMonth() !== prevMonth) {
        labelForColumn = MONTHS_RU[cur.getMonth()];
        prevMonth = cur.getMonth();
      }
    }
    weeks.push(week);
    monthLabels.push(labelForColumn);
  }

  return { weeks, monthLabels, total, maxCount };
}

/** Человекочитаемая дата клетки для тултипа: «8 июня 2026». */
export function formatCellDate(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
