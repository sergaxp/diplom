import { TaskRepeat, RepeatConfig, toDateStr } from '../../../lib/tasks';
import { getISOWeek } from '../../../lib/calendarLayout';

export { getISOWeek };

// ── Константы ─────────────────────────────────────────────────

export const MONTH_NAME = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                           'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
export const MONTH_GEN  = ['января','февраля','марта','апреля','мая','июня',
                           'июля','августа','сентября','октября','ноября','декабря'];
export const DAY_SHORT  = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];

export const WD_PREP: [string, string][] = [
  ['в', 'воскресенье'], ['в', 'понедельник'], ['во', 'вторник'],
  ['в', 'среду'], ['в', 'четверг'], ['в', 'пятницу'], ['в', 'субботу'],
];

/** «с/со [день в родительном падеже]» для мультидневного режима */
export const WD_WITH = [
  'с воскресенья', 'с понедельника', 'со вторника', 'со среды',
  'с четверга', 'с пятницы', 'с субботы',
];

// ── Дата-хелперы ──────────────────────────────────────────────

export function fromStr(s: string) { return new Date(s + 'T00:00:00'); }
export function today0() { const d = new Date(); d.setHours(0,0,0,0); return d; }
export function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(d.getDate()+n); return r; }
export function getNextMonday(from: Date) { const dow = from.getDay(); return addDays(from, dow === 0 ? 1 : 8 - dow); }
export function getNextSaturday(from: Date) { const dow = from.getDay(); const days = ((6-dow)+7)%7; return addDays(from, days === 0 ? 7 : days); }
export function nearestWeekday(from: Date) { let d = new Date(from); while (d.getDay()===0||d.getDay()===6) d=addDays(d,1); return d; }

export function scRight(d: Date, base: Date) {
  const diff = Math.round((d.getTime()-base.getTime())/86_400_000);
  const abbr = DAY_SHORT[d.getDay()];
  if (diff <= 1) return abbr;
  return `${abbr} ${d.getDate()} ${MONTH_GEN[d.getMonth()]}`;
}

export function getDateButtonLabel(s: string): string {
  const t = today0(); const d = fromStr(s);
  const diff = Math.round((d.getTime()-t.getTime())/86_400_000);
  if (diff === -1) return 'Вчера';
  if (diff ===  0) return 'Сегодня';
  if (diff ===  1) return 'Завтра';
  return `${d.getDate()} ${MONTH_GEN[d.getMonth()]}`;
}

export function buildGrid(year: number, month: number): (Date|null)[][] {
  const firstDow = (new Date(year,month,1).getDay()+6)%7;
  const days = new Date(year,month+1,0).getDate();
  const rows: (Date|null)[][] = [];
  let row: (Date|null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= days; d++) {
    row.push(new Date(year,month,d));
    if (row.length === 7) { rows.push(row); row = []; }
  }
  if (row.length) { while (row.length < 7) row.push(null); rows.push(row); }
  return rows;
}

export function fmtDisplay(s: string): string {
  const d = fromStr(s);
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
}

export function buildIso(day: string, mon: string, year: string): string | null {
  const dd = parseInt(day)||0, mm = parseInt(mon)||0, yyyy = parseInt(year)||0;
  if (dd < 1 || dd > 31 || mm < 1 || mm > 12 || yyyy < 1000 || yyyy > 9999) return null;
  const d = new Date(yyyy, mm-1, dd);
  if (d.getMonth() !== mm-1) return null;
  return toDateStr(d);
}

// ── Нормализация сегментов ввода даты ─────────────────────────

export function normalizeDaySegment(raw: string): { value: string; complete: boolean } {
  const digits = raw.replace(/\D/g,'');
  let val = digits.slice(0,2);
  if (val.length === 1 && parseInt(val[0]) > 3) val = '0' + val[0];
  val = val.slice(0,2);
  if (val.length === 2) {
    const n = parseInt(val);
    if (n < 1) val = '01';
    else if (n > 31) val = '31';
    return { value: val, complete: true };
  }
  return { value: val, complete: false };
}

export function normalizeMonthSegment(raw: string): { value: string; complete: boolean } {
  const d = raw.replace(/\D/g,'');
  let val = d.slice(0,2);
  if (val.length === 1 && parseInt(val[0]) > 1) val = '0' + val[0];
  val = val.slice(0,2);
  if (val.length === 2) {
    const n = parseInt(val);
    if (n < 1) val = '01';
    else if (n > 12) val = '12';
    return { value: val, complete: true };
  }
  return { value: val, complete: false };
}

export function normalizeYearSegment(raw: string): string {
  return raw.replace(/\D/g,'').slice(0,4);
}

// ── Деривация повтора ─────────────────────────────────────────

export interface RepeatDisplayValues {
  rptDow: number;
  rptWpre: string;
  rptWday: string;
  rptDay: number;
  rptMon: number;
}

interface RepeatLabelArgs extends RepeatDisplayValues {
  repeat: TaskRepeat;
  multiDay: boolean;
  repeatConfig: RepeatConfig | null | undefined;
}

export function getRepeatLabel({
  repeat, multiDay, repeatConfig, rptDow, rptWpre, rptWday, rptDay, rptMon,
}: RepeatLabelArgs): string {
  if (repeat==='none') return '↻ Повтор';
  if (repeat==='daily') return '↻ Каждый день';
  if (repeat==='weekdays') return '↻ Каждый будний день';
  if (repeat==='weekly') return multiDay
    ? `↻ Кажд. нед. ${WD_WITH[rptDow]}`
    : `↻ Кажд. нед. ${rptWpre} ${rptWday}`;
  if (repeat==='monthly') return multiDay
    ? `↻ С кажд. ${rptDay}-го числа`
    : `↻ Каждое ${rptDay} число`;
  if (repeat==='yearly') return multiDay
    ? `↻ С кажд. ${rptDay} ${MONTH_GEN[rptMon]}`
    : `↻ Каждое ${rptDay} ${MONTH_GEN[rptMon]}`;
  if (repeat==='custom'&&repeatConfig) {
    if (repeatConfig.dependencyDays != null) return `↻ Через ${repeatConfig.dependencyDays} дн. после выполн.`;
    if (repeatConfig.cyclicPattern?.length) return `↻ Цикл ${repeatConfig.cyclicPattern.reduce((s,p)=>s+p.active+p.rest,0)} дней`;
    const u = {day:'дн',week:'нед',month:'мес',year:'лет'}[repeatConfig.unit ?? 'day'];
    const base = `↻ Каждые ${repeatConfig.every ?? 1} ${u}`;
    if (repeatConfig.months?.length && repeatConfig.months.length < 12) return `${base}, сезонно`;
    return base;
  }
  return '↻ Повтор';
}

/** Опция повтора: `prefix` — обычный текст, `accent` — выделенный фрагмент (если есть). */
export interface RepeatOption {
  value: TaskRepeat;
  prefix: string;
  accent?: string;
}

interface RepeatOptionsArgs extends RepeatDisplayValues {
  multiDay: boolean;
  dayCount: number;
  rangeIsMonthOrMore: boolean;
  rangeIsYearOrMore: boolean;
}

export function getDayCount(date: string, endDate: string): number {
  return Math.round((fromStr(endDate).getTime() - fromStr(date).getTime()) / 86_400_000);
}

/** Диапазон ≥ 1 месяц (учитывает разную длину месяцев) */
export function rangeIsMonthOrMore(date: string, endDate: string): boolean {
  const start = fromStr(date);
  const end   = fromStr(endDate);
  const oneMonthLater = new Date(start);
  oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
  return end >= oneMonthLater;
}

/** Диапазон ≥ 1 год (учитывает високосные годы) */
export function rangeIsYearOrMore(date: string, endDate: string): boolean {
  const start = fromStr(date);
  const end   = fromStr(endDate);
  const oneYearLater = new Date(start);
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
  return end >= oneYearLater;
}

export function buildRepeatOptions({
  multiDay, dayCount, rangeIsMonthOrMore: monthOrMore, rangeIsYearOrMore: yearOrMore,
  rptDow, rptWpre, rptWday, rptDay, rptMon,
}: RepeatOptionsArgs): RepeatOption[] {
  const all: RepeatOption[] = [
    { value: 'daily', prefix: 'Каждый день' },
    {
      value: 'weekly',
      prefix: 'Каждую неделю ',
      accent: multiDay ? WD_WITH[rptDow] : `${rptWpre} ${rptWday}`,
    },
    { value: 'weekdays', prefix: 'Каждый будний день ', accent: '(Пн - Пт)' },
    {
      value: 'monthly',
      prefix: multiDay ? 'С каждого ' : 'Каждое ',
      accent: multiDay ? `${rptDay}-го числа` : `${rptDay} число`,
    },
    {
      value: 'yearly',
      prefix: multiDay ? 'С каждого ' : 'Каждое ',
      accent: `${rptDay} ${MONTH_GEN[rptMon]}`,
    },
  ];

  return all.filter(({ value }) => {
    if (!multiDay) return true;
    if (value === 'daily' || value === 'weekdays') return false;
    if (value === 'weekly'  && dayCount > 6)  return false;
    if (value === 'monthly' && monthOrMore) return false;
    if (value === 'yearly'  && yearOrMore)  return false;
    return true;
  });
}
