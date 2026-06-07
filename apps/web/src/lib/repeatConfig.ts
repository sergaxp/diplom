import { RepeatConfig, CyclicSegment, WeatherCondition, HolidaySettings } from './tasks';

export type RepeatMode = 'interval' | 'cyclic' | 'dependency' | 'monthdays';

export const WEEKDAYS = [
  { v: 1, s: 'Пн' }, { v: 2, s: 'Вт' }, { v: 3, s: 'Ср' },
  { v: 4, s: 'Чт' }, { v: 5, s: 'Пт' }, { v: 6, s: 'Сб' }, { v: 0, s: 'Вс' },
];

export const MONTHS_SHORT = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];

export const SEASONS: Array<{ label: string; months: number[] }> = [
  { label: 'Весна', months: [3, 4, 5]   },
  { label: 'Лето',  months: [6, 7, 8]   },
  { label: 'Осень', months: [9, 10, 11] },
  { label: 'Зима',  months: [12, 1, 2]  },
];

export const UNIT_OPTS = [
  { v: 'day',   one: 'день',    few: 'дня',    many: 'дней'    },
  { v: 'week',  one: 'неделю',  few: 'недели', many: 'недель'  },
  { v: 'month', one: 'месяц',   few: 'месяца', many: 'месяцев' },
  { v: 'year',  one: 'год',     few: 'года',   many: 'лет'     },
] as const;

export const RU_MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
export const RU_WD_SHORT = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

export function unitLabel(v: RepeatConfig['unit'], n: number): string {
  const u = UNIT_OPTS.find(o => o.v === v)!;
  if (n % 10 === 1 && n % 100 !== 11) return u.one;
  if (n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14)) return u.few;
  return u.many;
}

export function cycleTotalDays(pattern: CyclicSegment[]): number {
  return pattern.reduce((s, p) => s + p.active + p.rest, 0);
}

/** Прибавить N дней к YYYY-MM-DD и вернуть YYYY-MM-DD */
export function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 6×7 сетка дней месяца, понедельник первым; null для «пустых» ячеек */
export function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length < 42) cells.push(null);
  return cells;
}

/**
 * Минимально допустимый «каждые N» для multi-day задачи: «buffer ≥ 1 day»,
 * т.е. следующее вхождение начинается СТРОГО после окончания текущего
 * (back-to-back). Buffer = K - durationDays для day; для остальных единиц –
 * наименьшее N такое, что start + N*unit > end.
 *
 * Для 0-длительности (start == end) даёт 1 во всех единицах – позволяет
 * выставить «Каждый день / неделю / месяц / год».
 */
export function calcMinEvery(unit: 'day' | 'week' | 'month' | 'year', startStr: string, endStr: string): number {
  const start = new Date(startStr + 'T00:00:00');
  const end   = new Date(endStr   + 'T00:00:00');
  const durMs = end.getTime() - start.getTime();
  const durDays = Math.max(0, Math.round(durMs / 86_400_000));

  switch (unit) {
    case 'day':  return Math.max(1, durDays + 1);                     // back-to-back
    case 'week': return Math.max(1, Math.ceil((durDays + 1) / 7));     // ближайшая неделя без перекрытия
    case 'month': {
      let n = 1;
      while (true) {
        const next = new Date(start);
        next.setMonth(next.getMonth() + n);
        if (next > end) break;
        n++;
        if (n > 120) break;
      }
      return n;
    }
    case 'year': {
      let n = 1;
      while (true) {
        const next = new Date(start);
        next.setFullYear(next.getFullYear() + n);
        if (next > end) break;
        n++;
        if (n > 100) break;
      }
      return n;
    }
  }
}

/** Плоское состояние формы настройки повтора — общий контракт между хуком и чистыми функциями */
export interface RepeatFormState {
  mode: RepeatMode;

  // Интервальный режим
  every: number;
  unit: NonNullable<RepeatConfig['unit']>;
  weekdays: number[];
  skipWeekends: boolean;

  // Цикличный режим
  cyclicPattern: CyclicSegment[];

  // Режим «после выполнения»
  dependencyDays: number;

  // Режим «по дням месяца»
  monthDays: number[];

  // Условия
  useHolidays: boolean;
  skipHolidays: boolean;
  onlyOnHolidays: boolean;

  useWeather: boolean;
  skipRain: boolean;
  skipSnow: boolean;
  skipStorm: boolean;
  skipFog: boolean;
  skipCloudy: boolean;
  requireClear: boolean;
  minTempDay: string;
  maxTempDay: string;
  minTempNight: string;
  maxTempNight: string;

  useSeasonal: boolean;
  months: number[];

  conditionScope: 'perDay' | 'whole';

  // Завершение
  endMode: 'never' | 'after' | 'date';
  endAfter: number;
  endDate: string;

  // Контекст
  multiDay: boolean;
  selectedDate: string;
}

/** Состояние формы по умолчанию (для новой задачи без initial) */
export function defaultRepeatFormState(selectedDate: string, multiDay: boolean, startDow: number): RepeatFormState {
  return {
    mode: 'interval',

    every: 1,
    unit: 'day',
    weekdays: [startDow],
    skipWeekends: false,

    cyclicPattern: [{ active: 1, rest: 1 }],

    dependencyDays: 7,

    monthDays: [],

    useHolidays: false,
    skipHolidays: true,
    onlyOnHolidays: false,

    useWeather: false,
    skipRain: false,
    skipSnow: false,
    skipStorm: false,
    skipFog: false,
    skipCloudy: false,
    requireClear: false,
    minTempDay: '',
    maxTempDay: '',
    minTempNight: '',
    maxTempNight: '',

    useSeasonal: false,
    months: [],

    conditionScope: 'perDay',

    endMode: 'never',
    endAfter: 10,
    endDate: '',

    multiDay,
    selectedDate,
  };
}

/** Чистый аналог инициализирующего useEffect: строит состояние формы из сохранённого RepeatConfig */
export function parseInitialConfig(
  initial: RepeatConfig | null | undefined,
  selectedDate: string,
  multiDay: boolean,
  startDow: number,
): RepeatFormState {
  const state = defaultRepeatFormState(selectedDate, multiDay, startDow);
  if (!initial) return state;

  if (initial.monthDays?.length && !multiDay) {
    state.mode = 'monthdays';
    state.monthDays = initial.monthDays;
  } else if (initial.dependencyDays != null && !multiDay) {
    state.mode = 'dependency';
    state.dependencyDays = initial.dependencyDays;
  } else if (initial.cyclicPattern?.length && !multiDay) {
    state.mode = 'cyclic';
    state.cyclicPattern = initial.cyclicPattern;
  } else {
    state.mode = 'interval';
    state.every = initial.every ?? 1;
    state.unit = initial.unit ?? 'day';
    state.weekdays = initial.weekdays ?? [startDow];
    state.skipWeekends = initial.skipWeekends ?? false;
  }

  if (initial.months?.length) {
    state.useSeasonal = true;
    state.months = initial.months;
  }

  if (initial.conditionScope === 'whole') state.conditionScope = 'whole';

  if (initial.holidaySettings) {
    state.useHolidays = true;
    state.skipHolidays = initial.holidaySettings.skipHolidays ?? true;
    state.onlyOnHolidays = initial.holidaySettings.onlyOnHolidays ?? false;
  }

  if (initial.weatherCondition) {
    const wc = initial.weatherCondition;
    state.useWeather = true;
    state.skipRain = wc.skipRain ?? false;
    state.skipSnow = wc.skipSnow ?? false;
    state.skipStorm = wc.skipStorm ?? false;
    state.skipFog = wc.skipFog ?? false;
    state.skipCloudy = wc.skipCloudy ?? false;
    state.requireClear = wc.requireClear ?? false;
    state.minTempDay = wc.minTempDay != null ? String(wc.minTempDay) : '';
    state.maxTempDay = wc.maxTempDay != null ? String(wc.maxTempDay) : '';
    state.minTempNight = wc.minTempNight != null ? String(wc.minTempNight) : '';
    state.maxTempNight = wc.maxTempNight != null ? String(wc.maxTempNight) : '';
  }

  if (initial.endAfter) {
    state.endMode = 'after';
    state.endAfter = initial.endAfter;
  }

  return state;
}

export interface BuiltRepeatConfig {
  cfg: RepeatConfig;
  until?: string;
}

/** Чистый аналог handleSave: строит RepeatConfig + repeatUntil из состояния формы */
export function buildRepeatConfig(state: RepeatFormState): BuiltRepeatConfig {
  const { mode, multiDay, selectedDate } = state;
  const cfg: RepeatConfig = {};

  if (mode === 'monthdays') {
    cfg.monthDays = state.monthDays.length
      ? [...state.monthDays].sort((a, b) => a - b)
      : [new Date(selectedDate + 'T00:00:00').getDate()];
  } else if (mode === 'dependency') {
    cfg.dependencyDays = Math.max(1, state.dependencyDays);
  } else if (mode === 'cyclic') {
    cfg.cyclicPattern = state.cyclicPattern.filter(s => s.active > 0 || s.rest > 0);
    if (!cfg.cyclicPattern.length) cfg.cyclicPattern = [{ active: 1, rest: 0 }];
  } else {
    cfg.every = state.every;
    cfg.unit  = state.unit;
    if (state.unit === 'week' && state.weekdays.length > 0 && !multiDay) cfg.weekdays = state.weekdays;
    if (state.skipWeekends && state.unit !== 'week' && !multiDay) cfg.skipWeekends = true;
  }

  if (state.endMode === 'after' && state.endAfter > 0) cfg.endAfter = state.endAfter;

  if (state.useSeasonal && state.months.length > 0 && state.months.length < 12) {
    cfg.months = [...state.months].sort((a, b) => a - b);
  }

  if (multiDay && state.conditionScope === 'whole') {
    cfg.conditionScope = 'whole';
  }

  if (state.useHolidays) {
    const hs: HolidaySettings = {};
    if (state.onlyOnHolidays) hs.onlyOnHolidays = true;
    else if (state.skipHolidays) hs.skipHolidays = true;
    if (Object.keys(hs).length) cfg.holidaySettings = hs;
  }

  if (state.useWeather) {
    const wc: WeatherCondition = {};
    if (state.skipRain)     wc.skipRain     = true;
    if (state.skipSnow)     wc.skipSnow     = true;
    if (state.skipStorm)    wc.skipStorm    = true;
    if (state.skipFog)      wc.skipFog      = true;
    if (state.skipCloudy)   wc.skipCloudy   = true;
    if (state.requireClear) wc.requireClear = true;
    if (state.minTempDay.trim())   wc.minTempDay   = Number(state.minTempDay);
    if (state.maxTempDay.trim())   wc.maxTempDay   = Number(state.maxTempDay);
    if (state.minTempNight.trim()) wc.minTempNight = Number(state.minTempNight);
    if (state.maxTempNight.trim()) wc.maxTempNight = Number(state.maxTempNight);
    if (Object.keys(wc).length) cfg.weatherCondition = wc;
  }

  const until = state.endMode === 'date' && state.endDate ? state.endDate : undefined;
  return { cfg, until };
}
