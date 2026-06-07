import { describe, it, expect } from 'vitest';
import {
  unitLabel,
  cycleTotalDays,
  addDaysStr,
  buildMonthGrid,
  calcMinEvery,
  buildRepeatConfig,
  parseInitialConfig,
  defaultRepeatFormState,
  type RepeatFormState,
} from './repeatConfig';
import type { RepeatConfig } from './tasks';

// ── unitLabel ─────────────────────────────────────────────────

describe('unitLabel', () => {
  it.each([
    ['day', 1, 'день'],
    ['day', 2, 'дня'],
    ['day', 5, 'дней'],
    ['day', 11, 'дней'],
    ['day', 21, 'день'],
    ['week', 1, 'неделю'],
    ['week', 2, 'недели'],
    ['week', 5, 'недель'],
    ['month', 1, 'месяц'],
    ['month', 2, 'месяца'],
    ['month', 5, 'месяцев'],
    ['year', 1, 'год'],
    ['year', 2, 'года'],
    ['year', 5, 'лет'],
  ] as const)('unitLabel(%s, %d) -> %s', (unit, n, expected) => {
    expect(unitLabel(unit, n)).toBe(expected);
  });
});

// ── cycleTotalDays ────────────────────────────────────────────

describe('cycleTotalDays', () => {
  it('sums active+rest across all segments', () => {
    expect(cycleTotalDays([{ active: 2, rest: 1 }, { active: 3, rest: 4 }])).toBe(10);
  });

  it('returns 0 for empty pattern', () => {
    expect(cycleTotalDays([])).toBe(0);
  });
});

// ── addDaysStr ────────────────────────────────────────────────

describe('addDaysStr', () => {
  it('adds days within the same month', () => {
    expect(addDaysStr('2026-06-10', 5)).toBe('2026-06-15');
  });

  it('crosses a month boundary', () => {
    expect(addDaysStr('2026-01-30', 3)).toBe('2026-02-02');
  });

  it('crosses a year boundary', () => {
    expect(addDaysStr('2026-12-30', 5)).toBe('2027-01-04');
  });
});

// ── buildMonthGrid ────────────────────────────────────────────

describe('buildMonthGrid', () => {
  it('always returns a 42-cell grid', () => {
    expect(buildMonthGrid(2026, 5).length).toBe(42);
    expect(buildMonthGrid(2026, 1).length).toBe(42);
  });

  it('pads with nulls for a month starting on Sunday (Mon-first week)', () => {
    // 2026-02-01 is Sunday -> 6 leading empty cells (Mon..Sat)
    const cells = buildMonthGrid(2026, 1);
    expect(cells.slice(0, 6).every(c => c === null)).toBe(true);
    expect(cells[6]?.getDate()).toBe(1);
  });

  it('has no leading padding for a month starting on Monday', () => {
    // 2026-06-01 is Monday
    const cells = buildMonthGrid(2026, 5);
    expect(cells[0]).not.toBeNull();
    expect(cells[0]?.getDate()).toBe(1);
  });
});

// ── calcMinEvery ──────────────────────────────────────────────

describe('calcMinEvery', () => {
  it('returns 1 for zero-duration (start == end) for every unit', () => {
    expect(calcMinEvery('day', '2026-06-10', '2026-06-10')).toBe(1);
    expect(calcMinEvery('week', '2026-06-10', '2026-06-10')).toBe(1);
    expect(calcMinEvery('month', '2026-06-10', '2026-06-10')).toBe(1);
    expect(calcMinEvery('year', '2026-06-10', '2026-06-10')).toBe(1);
  });

  it('day: back-to-back means N = duration + 1', () => {
    // span 10..12 -> 2 days duration -> next must start at 13 -> every >= 3
    expect(calcMinEvery('day', '2026-06-10', '2026-06-12')).toBe(3);
  });

  it('week: smallest N of weeks with no overlap', () => {
    // 8-day task -> durDays=8 -> ceil(9/7) = 2
    expect(calcMinEvery('week', '2026-06-01', '2026-06-09')).toBe(2);
  });

  it('month: smallest N such that start + N months > end', () => {
    // task spans 2026-01-10..2026-02-15 (more than a month) -> needs 2 months
    expect(calcMinEvery('month', '2026-01-10', '2026-02-15')).toBe(2);
    // task spans less than a month -> 1 month suffices
    expect(calcMinEvery('month', '2026-01-10', '2026-01-20')).toBe(1);
  });

  it('year: smallest N such that start + N years > end', () => {
    expect(calcMinEvery('year', '2026-01-10', '2027-06-01')).toBe(2);
    expect(calcMinEvery('year', '2026-01-10', '2026-06-01')).toBe(1);
  });

  it('back-to-back occurrences do not overlap the task duration', () => {
    const start = '2026-06-10';
    const end = '2026-06-12'; // 3-day task
    const n = calcMinEvery('day', start, end);
    const nextStart = addDaysStr(start, n);
    expect(nextStart > end).toBe(true);
  });
});

// ── buildRepeatConfig ─────────────────────────────────────────

function baseState(overrides: Partial<RepeatFormState> = {}): RepeatFormState {
  return {
    ...defaultRepeatFormState('2026-06-10', false, 3),
    ...overrides,
  };
}

describe('buildRepeatConfig', () => {
  it('interval mode: writes every/unit, weekdays only for week & !multiDay', () => {
    const { cfg } = buildRepeatConfig(baseState({ mode: 'interval', every: 2, unit: 'week', weekdays: [1, 3] }));
    expect(cfg.every).toBe(2);
    expect(cfg.unit).toBe('week');
    expect(cfg.weekdays).toEqual([1, 3]);
    expect(cfg.skipWeekends).toBeUndefined();
  });

  it('interval mode: weekdays omitted when multiDay', () => {
    const { cfg } = buildRepeatConfig(baseState({ mode: 'interval', unit: 'week', weekdays: [1, 3], multiDay: true }));
    expect(cfg.weekdays).toBeUndefined();
  });

  it('interval mode: skipWeekends only when unit != week and !multiDay', () => {
    const { cfg: c1 } = buildRepeatConfig(baseState({ mode: 'interval', unit: 'day', skipWeekends: true }));
    expect(c1.skipWeekends).toBe(true);

    const { cfg: c2 } = buildRepeatConfig(baseState({ mode: 'interval', unit: 'week', skipWeekends: true }));
    expect(c2.skipWeekends).toBeUndefined();

    const { cfg: c3 } = buildRepeatConfig(baseState({ mode: 'interval', unit: 'day', skipWeekends: true, multiDay: true }));
    expect(c3.skipWeekends).toBeUndefined();
  });

  it('cyclic mode: filters zero segments, falls back to default if all empty', () => {
    const { cfg: c1 } = buildRepeatConfig(baseState({ mode: 'cyclic', cyclicPattern: [{ active: 2, rest: 1 }, { active: 0, rest: 0 }] }));
    expect(c1.cyclicPattern).toEqual([{ active: 2, rest: 1 }]);

    const { cfg: c2 } = buildRepeatConfig(baseState({ mode: 'cyclic', cyclicPattern: [{ active: 0, rest: 0 }] }));
    expect(c2.cyclicPattern).toEqual([{ active: 1, rest: 0 }]);
  });

  it('dependency mode: clamps to >= 1', () => {
    const { cfg } = buildRepeatConfig(baseState({ mode: 'dependency', dependencyDays: 0 }));
    expect(cfg.dependencyDays).toBe(1);
  });

  it('monthdays mode: uses sorted selection or falls back to selectedDate day', () => {
    const { cfg: c1 } = buildRepeatConfig(baseState({ mode: 'monthdays', monthDays: [20, 5, 15] }));
    expect(c1.monthDays).toEqual([5, 15, 20]);

    const { cfg: c2 } = buildRepeatConfig(baseState({ mode: 'monthdays', monthDays: [], selectedDate: '2026-06-10' }));
    expect(c2.monthDays).toEqual([10]);
  });

  it('seasonality: written only when 0 < months.length < 12, sorted', () => {
    const { cfg: c1 } = buildRepeatConfig(baseState({ useSeasonal: true, months: [6, 3] }));
    expect(c1.months).toEqual([3, 6]);

    const { cfg: c2 } = baseStateResult({ useSeasonal: true, months: [] });
    expect(c2.months).toBeUndefined();

    const { cfg: c3 } = baseStateResult({ useSeasonal: false, months: [3, 6] });
    expect(c3.months).toBeUndefined();

    const { cfg: c4 } = baseStateResult({ useSeasonal: true, months: Array.from({ length: 12 }, (_, i) => i + 1) });
    expect(c4.months).toBeUndefined();
  });

  it('conditionScope: written as "whole" only when multiDay', () => {
    const { cfg: c1 } = buildRepeatConfig(baseState({ multiDay: true, conditionScope: 'whole' }));
    expect(c1.conditionScope).toBe('whole');

    const { cfg: c2 } = buildRepeatConfig(baseState({ multiDay: false, conditionScope: 'whole' }));
    expect(c2.conditionScope).toBeUndefined();
  });

  it('holidays: skip vs only-on, omitted when neither flag set', () => {
    const { cfg: c1 } = buildRepeatConfig(baseState({ useHolidays: true, skipHolidays: true, onlyOnHolidays: false }));
    expect(c1.holidaySettings).toEqual({ skipHolidays: true });

    const { cfg: c2 } = buildRepeatConfig(baseState({ useHolidays: true, skipHolidays: false, onlyOnHolidays: true }));
    expect(c2.holidaySettings).toEqual({ onlyOnHolidays: true });

    const { cfg: c3 } = buildRepeatConfig(baseState({ useHolidays: true, skipHolidays: false, onlyOnHolidays: false }));
    expect(c3.holidaySettings).toBeUndefined();

    const { cfg: c4 } = buildRepeatConfig(baseState({ useHolidays: false, skipHolidays: true }));
    expect(c4.holidaySettings).toBeUndefined();
  });

  it('weather: collects only set flags and parsed temperatures', () => {
    const { cfg } = buildRepeatConfig(baseState({
      useWeather: true,
      skipRain: true,
      skipSnow: false,
      requireClear: true,
      minTempDay: '5',
      maxTempDay: '',
      minTempNight: ' -3 ',
      maxTempNight: '',
    }));
    expect(cfg.weatherCondition).toEqual({
      skipRain: true,
      requireClear: true,
      minTempDay: 5,
      minTempNight: -3,
    });
  });

  it('weather: omitted entirely when useWeather is false or all fields empty', () => {
    const { cfg: c1 } = buildRepeatConfig(baseState({ useWeather: false, skipRain: true }));
    expect(c1.weatherCondition).toBeUndefined();

    const { cfg: c2 } = buildRepeatConfig(baseState({ useWeather: true }));
    expect(c2.weatherCondition).toBeUndefined();
  });

  it('endMode "after" writes endAfter only when > 0', () => {
    const { cfg: c1 } = buildRepeatConfig(baseState({ endMode: 'after', endAfter: 5 }));
    expect(c1.endAfter).toBe(5);

    const { cfg: c2 } = buildRepeatConfig(baseState({ endMode: 'after', endAfter: 0 }));
    expect(c2.endAfter).toBeUndefined();

    const { cfg: c3 } = buildRepeatConfig(baseState({ endMode: 'never', endAfter: 5 }));
    expect(c3.endAfter).toBeUndefined();
  });

  it('endMode "date" returns until only when endDate is set', () => {
    const { until: u1 } = buildRepeatConfig(baseState({ endMode: 'date', endDate: '2026-07-01' }));
    expect(u1).toBe('2026-07-01');

    const { until: u2 } = buildRepeatConfig(baseState({ endMode: 'date', endDate: '' }));
    expect(u2).toBeUndefined();

    const { until: u3 } = buildRepeatConfig(baseState({ endMode: 'never', endDate: '2026-07-01' }));
    expect(u3).toBeUndefined();
  });
});

function baseStateResult(overrides: Partial<RepeatFormState>) {
  return buildRepeatConfig(baseState(overrides));
}

// ── parseInitialConfig ────────────────────────────────────────

describe('parseInitialConfig', () => {
  const SELECTED = '2026-06-10';
  const START_DOW = 3;

  it('returns default state when initial is null/undefined', () => {
    const s1 = parseInitialConfig(null, SELECTED, false, START_DOW);
    const s2 = parseInitialConfig(undefined, SELECTED, false, START_DOW);
    expect(s1).toEqual(defaultRepeatFormState(SELECTED, false, START_DOW));
    expect(s2).toEqual(defaultRepeatFormState(SELECTED, false, START_DOW));
  });

  it('restores monthdays mode', () => {
    const initial: RepeatConfig = { monthDays: [1, 15] };
    const s = parseInitialConfig(initial, SELECTED, false, START_DOW);
    expect(s.mode).toBe('monthdays');
    expect(s.monthDays).toEqual([1, 15]);
  });

  it('restores dependency mode', () => {
    const initial: RepeatConfig = { dependencyDays: 5 };
    const s = parseInitialConfig(initial, SELECTED, false, START_DOW);
    expect(s.mode).toBe('dependency');
    expect(s.dependencyDays).toBe(5);
  });

  it('restores cyclic mode', () => {
    const initial: RepeatConfig = { cyclicPattern: [{ active: 3, rest: 2 }] };
    const s = parseInitialConfig(initial, SELECTED, false, START_DOW);
    expect(s.mode).toBe('cyclic');
    expect(s.cyclicPattern).toEqual([{ active: 3, rest: 2 }]);
  });

  it('restores interval mode with all fields, defaulting missing ones', () => {
    const initial: RepeatConfig = { every: 3, unit: 'week', weekdays: [2, 4], skipWeekends: true };
    const s = parseInitialConfig(initial, SELECTED, false, START_DOW);
    expect(s.mode).toBe('interval');
    expect(s.every).toBe(3);
    expect(s.unit).toBe('week');
    expect(s.weekdays).toEqual([2, 4]);
    expect(s.skipWeekends).toBe(true);
  });

  it('falls back to interval mode when initial is empty', () => {
    const s = parseInitialConfig({}, SELECTED, false, START_DOW);
    expect(s.mode).toBe('interval');
    expect(s.every).toBe(1);
    expect(s.unit).toBe('day');
    expect(s.weekdays).toEqual([START_DOW]);
  });

  it('ignores cyclic/dependency/monthdays when multiDay -> falls back to interval', () => {
    const i1 = parseInitialConfig({ monthDays: [1] }, SELECTED, true, START_DOW);
    expect(i1.mode).toBe('interval');

    const i2 = parseInitialConfig({ dependencyDays: 5 }, SELECTED, true, START_DOW);
    expect(i2.mode).toBe('interval');

    const i3 = parseInitialConfig({ cyclicPattern: [{ active: 1, rest: 1 }] }, SELECTED, true, START_DOW);
    expect(i3.mode).toBe('interval');
  });

  it('restores seasonality', () => {
    const s = parseInitialConfig({ months: [3, 4, 5] }, SELECTED, false, START_DOW);
    expect(s.useSeasonal).toBe(true);
    expect(s.months).toEqual([3, 4, 5]);
  });

  it('restores conditionScope only when "whole"', () => {
    const s1 = parseInitialConfig({ conditionScope: 'whole' }, SELECTED, true, START_DOW);
    expect(s1.conditionScope).toBe('whole');

    const s2 = parseInitialConfig({ conditionScope: 'perDay' }, SELECTED, true, START_DOW);
    expect(s2.conditionScope).toBe('perDay');
  });

  it('restores holiday settings with defaults', () => {
    const s1 = parseInitialConfig({ holidaySettings: {} }, SELECTED, false, START_DOW);
    expect(s1.useHolidays).toBe(true);
    expect(s1.skipHolidays).toBe(true);
    expect(s1.onlyOnHolidays).toBe(false);

    const s2 = parseInitialConfig({ holidaySettings: { onlyOnHolidays: true, skipHolidays: false } }, SELECTED, false, START_DOW);
    expect(s2.skipHolidays).toBe(false);
    expect(s2.onlyOnHolidays).toBe(true);
  });

  it('restores weather condition fields, formatting temperatures as strings', () => {
    const initial: RepeatConfig = {
      weatherCondition: {
        skipRain: true,
        minTempDay: 5,
        maxTempNight: -2,
      },
    };
    const s = parseInitialConfig(initial, SELECTED, false, START_DOW);
    expect(s.useWeather).toBe(true);
    expect(s.skipRain).toBe(true);
    expect(s.skipSnow).toBe(false);
    expect(s.minTempDay).toBe('5');
    expect(s.maxTempDay).toBe('');
    expect(s.maxTempNight).toBe('-2');
  });

  it('restores endAfter mode', () => {
    const s = parseInitialConfig({ endAfter: 7 }, SELECTED, false, START_DOW);
    expect(s.endMode).toBe('after');
    expect(s.endAfter).toBe(7);
  });
});
