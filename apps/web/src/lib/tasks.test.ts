import { describe, it, expect } from 'vitest';
import {
  toDateStr,
  completionKey,
  getMultiDayOccurrence,
  checkWeatherCondition,
  checkHolidayCondition,
  getTasksForDate,
  type Task,
  type RepeatConfig,
} from './tasks';

// ── Helpers ───────────────────────────────────────────────────

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Test task',
    date: '2026-01-01',
    repeat: 'none',
    type: 'normal',
    status: 'pending',
    ...overrides,
  };
}

function d(s: string): Date {
  return new Date(s + 'T00:00:00');
}

// ──────────────────────────────────────────────────────────────
// 1. toDateStr / completionKey
// ──────────────────────────────────────────────────────────────

describe('toDateStr', () => {
  it('formats single-digit month and day with zero padding', () => {
    expect(toDateStr(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
  it('formats two-digit month and day correctly', () => {
    expect(toDateStr(new Date(2026, 10, 25))).toBe('2026-11-25');
  });
});

describe('completionKey', () => {
  it('joins id and date with double underscore', () => {
    expect(completionKey('abc', '2026-01-01')).toBe('abc__2026-01-01');
  });
});

// ──────────────────────────────────────────────────────────────
// 2. checkWeatherCondition
// ──────────────────────────────────────────────────────────────

describe('checkWeatherCondition', () => {
  const weather = (code: number, tempMax = 20, tempMin = 10) =>
    ({ tempMax, tempMin, weatherCode: code });
  // Helper для проверки только результата ok/!ok (без warning)
  const wOk = (entry: any, cond: any) => checkWeatherCondition(entry, cond).ok;

  it('returns ok=false when entry is undefined (strict: no data → hide)', () => {
    expect(checkWeatherCondition(undefined, { skipRain: true })).toEqual({ ok: false });
  });

  it('returns ok=true when condition is empty and data available', () => {
    expect(checkWeatherCondition(weather(61), {})).toEqual({ ok: true });
  });

  describe('skipRain', () => {
    it('skips moderate rain (61)', () => { expect(wOk(weather(61), { skipRain: true })).toBe(false); });
    it('skips drizzle (51)', () => { expect(wOk(weather(51), { skipRain: true })).toBe(false); });
    it('skips rain showers (80)', () => { expect(wOk(weather(80), { skipRain: true })).toBe(false); });
    it('skips thunderstorm (95)', () => { expect(wOk(weather(95), { skipRain: true })).toBe(false); });
    it('does not skip snow (71)', () => { expect(wOk(weather(71), { skipRain: true })).toBe(true); });
    it('does not skip clear (0)', () => { expect(wOk(weather(0), { skipRain: true })).toBe(true); });
  });

  describe('skipSnow', () => {
    it('skips snow (71)', () => { expect(wOk(weather(71), { skipSnow: true })).toBe(false); });
    it('skips snow showers (85)', () => { expect(wOk(weather(85), { skipSnow: true })).toBe(false); });
    it('does not skip rain (61)', () => { expect(wOk(weather(61), { skipSnow: true })).toBe(true); });
  });

  describe('skipStorm', () => {
    it('skips thunderstorm (95)', () => { expect(wOk(weather(95), { skipStorm: true })).toBe(false); });
    it('skips storm with hail (96)', () => { expect(wOk(weather(96), { skipStorm: true })).toBe(false); });
    it('does not skip plain rain (61)', () => { expect(wOk(weather(61), { skipStorm: true })).toBe(true); });
  });

  describe('skipFog', () => {
    it('skips fog (45)', () => { expect(wOk(weather(45), { skipFog: true })).toBe(false); });
    it('skips deposit fog (48)', () => { expect(wOk(weather(48), { skipFog: true })).toBe(false); });
    it('does not skip overcast (3)', () => { expect(wOk(weather(3), { skipFog: true })).toBe(true); });
  });

  describe('skipCloudy', () => {
    it('skips overcast (3)', () => { expect(wOk(weather(3), { skipCloudy: true })).toBe(false); });
    it('does not skip partly cloudy (2)', () => { expect(wOk(weather(2), { skipCloudy: true })).toBe(true); });
  });

  describe('requireClear', () => {
    it('passes for clear (0)', () => { expect(wOk(weather(0), { requireClear: true })).toBe(true); });
    it('passes for mostly clear (1)', () => { expect(wOk(weather(1), { requireClear: true })).toBe(true); });
    it('fails for partly cloudy (2)', () => { expect(wOk(weather(2), { requireClear: true })).toBe(false); });
    it('fails for overcast (3)', () => { expect(wOk(weather(3), { requireClear: true })).toBe(false); });
  });

  describe('temperature thresholds (strict + tolerance ±2°C)', () => {
    it('passes when temp in strict range, no warning', () => {
      const res = checkWeatherCondition(weather(0, 22, 10), { minTempDay: 20 });
      expect(res).toEqual({ ok: true });
    });
    it('minTempDay: strict reject when 3°C below', () => {
      expect(wOk(weather(0, 17, 5), { minTempDay: 20 })).toBe(false);
    });
    it('minTempDay: tolerated +warning when 1°C below', () => {
      const res = checkWeatherCondition(weather(0, 19, 5), { minTempDay: 20 });
      expect(res.ok).toBe(true);
      expect(res.warning).toBeDefined();
      expect(res.warning).toContain('19');
    });
    it('minTempDay: tolerated +warning when exactly 2°C below (boundary)', () => {
      const res = checkWeatherCondition(weather(0, 18, 5), { minTempDay: 20 });
      expect(res.ok).toBe(true);
      expect(res.warning).toBeDefined();
    });
    it('maxTempDay: strict reject when 3°C above', () => {
      expect(wOk(weather(0, 28, 5), { maxTempDay: 25 })).toBe(false);
    });
    it('maxTempDay: tolerated +warning when 1°C above', () => {
      const res = checkWeatherCondition(weather(0, 26, 5), { maxTempDay: 25 });
      expect(res.ok).toBe(true);
      expect(res.warning).toContain('26');
    });
    it('minTempNight: strict reject below tolerance', () => {
      expect(wOk(weather(0, 20, 7), { minTempNight: 10 })).toBe(false);
    });
    it('minTempNight: tolerated +warning at 1°C below', () => {
      const res = checkWeatherCondition(weather(0, 20, 9), { minTempNight: 10 });
      expect(res.ok).toBe(true);
      expect(res.warning).toContain('ночью');
    });
    it('maxTempNight: strict reject above tolerance', () => {
      expect(wOk(weather(0, 20, 13), { maxTempNight: 10 })).toBe(false);
    });
    it('combines multiple thresholds; all warnings collected', () => {
      const res = checkWeatherCondition(weather(0, 19, 9), { minTempDay: 20, minTempNight: 10 });
      expect(res.ok).toBe(true);
      expect(res.warning).toContain('днём');
      expect(res.warning).toContain('ночью');
    });
  });
});

// ──────────────────────────────────────────────────────────────
// 3. checkHolidayCondition
// ──────────────────────────────────────────────────────────────

describe('checkHolidayCondition', () => {
  it('returns true when holiday map is null', () => {
    expect(checkHolidayCondition('2026-01-01', null, { skipHolidays: true })).toBe(true);
  });

  describe('skipHolidays', () => {
    const map = new Map([['2026-01-01', { type: 'holiday' }]]);
    it('hides on holiday', () => {
      expect(checkHolidayCondition('2026-01-01', map, { skipHolidays: true })).toBe(false);
    });
    it('shows on non-holiday', () => {
      expect(checkHolidayCondition('2026-01-02', map, { skipHolidays: true })).toBe(true);
    });
    it('does not hide on shortday (only holiday type)', () => {
      const m = new Map([['2026-02-23', { type: 'shortday' }]]);
      expect(checkHolidayCondition('2026-02-23', m, { skipHolidays: true })).toBe(true);
    });
  });

  describe('onlyOnHolidays', () => {
    const map = new Map([['2026-01-01', { type: 'holiday' }]]);
    it('shows on holiday', () => {
      expect(checkHolidayCondition('2026-01-01', map, { onlyOnHolidays: true })).toBe(true);
    });
    it('hides on non-holiday', () => {
      expect(checkHolidayCondition('2026-01-02', map, { onlyOnHolidays: true })).toBe(false);
    });
  });
});

// ──────────────────────────────────────────────────────────────
// 4. getMultiDayOccurrence
// ──────────────────────────────────────────────────────────────

describe('getMultiDayOccurrence', () => {
  describe('original (first) occurrence', () => {
    const task = makeTask({ date: '2026-01-01', endDate: '2026-01-05', repeat: 'weekly' });

    it('returns original range when date is inside it', () => {
      expect(getMultiDayOccurrence(task, '2026-01-03')).toEqual({
        startStr: '2026-01-01',
        endStr: '2026-01-05',
      });
    });
    it('returns original range on start day', () => {
      expect(getMultiDayOccurrence(task, '2026-01-01')).toEqual({
        startStr: '2026-01-01',
        endStr: '2026-01-05',
      });
    });
    it('returns original range on end day', () => {
      expect(getMultiDayOccurrence(task, '2026-01-05')).toEqual({
        startStr: '2026-01-01',
        endStr: '2026-01-05',
      });
    });
    it('returns null before start', () => {
      expect(getMultiDayOccurrence(task, '2025-12-31')).toBeNull();
    });
  });

  describe('weekly multi-day repeat', () => {
    const task = makeTask({ date: '2026-01-05', endDate: '2026-01-07', repeat: 'weekly' });

    it('finds next occurrence the following week', () => {
      // Jan 5 2026 was Monday. Next Monday: Jan 12.
      expect(getMultiDayOccurrence(task, '2026-01-12')).toEqual({
        startStr: '2026-01-12',
        endStr: '2026-01-14',
      });
    });
    it('matches middle day of next occurrence', () => {
      expect(getMultiDayOccurrence(task, '2026-01-13')).toEqual({
        startStr: '2026-01-12',
        endStr: '2026-01-14',
      });
    });
    it('returns null between occurrences', () => {
      expect(getMultiDayOccurrence(task, '2026-01-10')).toBeNull();
    });
  });

  describe('monthly multi-day repeat', () => {
    const task = makeTask({ date: '2026-01-15', endDate: '2026-01-17', repeat: 'monthly' });

    it('repeats on same day next month', () => {
      expect(getMultiDayOccurrence(task, '2026-02-15')).toEqual({
        startStr: '2026-02-15',
        endStr: '2026-02-17',
      });
    });
  });

  describe('yearly multi-day repeat', () => {
    const task = makeTask({ date: '2026-12-25', endDate: '2026-12-27', repeat: 'yearly' });

    it('repeats next year same date', () => {
      expect(getMultiDayOccurrence(task, '2027-12-26')).toEqual({
        startStr: '2027-12-25',
        endStr: '2027-12-27',
      });
    });
  });

  describe('custom interval multi-day repeat (Conflict #2 fix)', () => {
    it('every 3 days with 2-day duration', () => {
      const task = makeTask({
        date: '2026-01-01', endDate: '2026-01-02', repeat: 'custom',
        repeatConfig: { every: 3, unit: 'day' },
      });
      // Original Jan 1-2. Next start: Jan 4. Then Jan 7.
      expect(getMultiDayOccurrence(task, '2026-01-04')).toEqual({
        startStr: '2026-01-04', endStr: '2026-01-05',
      });
      expect(getMultiDayOccurrence(task, '2026-01-07')).toEqual({
        startStr: '2026-01-07', endStr: '2026-01-08',
      });
      expect(getMultiDayOccurrence(task, '2026-01-06')).toBeNull();
    });

    it('every 2 weeks with 3-day duration', () => {
      const task = makeTask({
        date: '2026-01-01', endDate: '2026-01-03', repeat: 'custom',
        repeatConfig: { every: 2, unit: 'week' },
      });
      // Original Jan 1-3 (Thu-Sat). Next: Jan 15-17. Then Jan 29-31.
      expect(getMultiDayOccurrence(task, '2026-01-15')).toEqual({
        startStr: '2026-01-15', endStr: '2026-01-17',
      });
      expect(getMultiDayOccurrence(task, '2026-01-08')).toBeNull();
    });

    it('every 2 months with 4-day duration', () => {
      const task = makeTask({
        date: '2026-01-10', endDate: '2026-01-13', repeat: 'custom',
        repeatConfig: { every: 2, unit: 'month' },
      });
      // Next occurrence: Mar 10-13. Not Feb.
      expect(getMultiDayOccurrence(task, '2026-03-10')).toEqual({
        startStr: '2026-03-10', endStr: '2026-03-13',
      });
      expect(getMultiDayOccurrence(task, '2026-02-10')).toBeNull();
    });

    it('returns null for cyclic pattern (not supported)', () => {
      const task = makeTask({
        date: '2026-01-01', endDate: '2026-01-02', repeat: 'custom',
        repeatConfig: { cyclicPattern: [{ active: 2, rest: 2 }] },
      });
      expect(getMultiDayOccurrence(task, '2026-01-05')).toBeNull();
    });

    it('returns null for dependency mode (not supported)', () => {
      const task = makeTask({
        date: '2026-01-01', endDate: '2026-01-02', repeat: 'custom',
        repeatConfig: { dependencyDays: 7 },
      });
      expect(getMultiDayOccurrence(task, '2026-01-09')).toBeNull();
    });

    it('returns null when weekdays specified (not supported)', () => {
      const task = makeTask({
        date: '2026-01-01', endDate: '2026-01-02', repeat: 'custom',
        repeatConfig: { every: 1, unit: 'week', weekdays: [1, 3] },
      });
      expect(getMultiDayOccurrence(task, '2026-01-08')).toBeNull();
    });
  });

  describe('repeatUntil truncation (Conflict #3 fix)', () => {
    // Jan 1 2026 = Thursday. Weekly repeat of a 5-day task (Jan 1-5)
    // → next occurrence Jan 8-12 (Thu-Mon, same DOW alignment).
    it('returns null when occurrence end exceeds repeatUntil', () => {
      const task = makeTask({
        date: '2026-01-01', endDate: '2026-01-05', repeat: 'weekly',
        repeatUntil: '2026-01-11', // next occ Jan 8-12 exceeds by 1 day
      });
      expect(getMultiDayOccurrence(task, '2026-01-09')).toBeNull();
    });

    it('allows occurrence that fits entirely within repeatUntil', () => {
      const task = makeTask({
        date: '2026-01-01', endDate: '2026-01-05', repeat: 'weekly',
        repeatUntil: '2026-01-12', // exactly fits
      });
      expect(getMultiDayOccurrence(task, '2026-01-09')).toEqual({
        startStr: '2026-01-08', endStr: '2026-01-12',
      });
    });
  });

  describe('edge cases', () => {
    it('returns null for non-multi-day task', () => {
      expect(getMultiDayOccurrence(makeTask({ endDate: undefined }), '2026-01-01')).toBeNull();
    });
    it('returns null when repeat is none and date is past endDate', () => {
      const task = makeTask({ date: '2026-01-01', endDate: '2026-01-03', repeat: 'none' });
      expect(getMultiDayOccurrence(task, '2026-01-10')).toBeNull();
    });
  });

  describe('Fix 5: monthly/yearly preserve calendar start & end dates', () => {
    it('monthly: occurrence preserves day-of-month for both ends', () => {
      // Короткая задача через границу месяца: 28.01 — 03.02 (6 дней), monthly.
      // 2-е вхождение должно быть 28.02 — 03.03 (день-в-день календарно).
      const task = makeTask({ date: '2026-01-28', endDate: '2026-02-03', repeat: 'monthly' });
      expect(getMultiDayOccurrence(task, '2026-03-02')).toEqual({
        startStr: '2026-02-28', endStr: '2026-03-03',
      });
    });

    it('yearly: occurrence preserves month-day pair for both ends', () => {
      // 28.12.2026 — 03.01.2027 yearly. 2-е вхождение: 28.12.2027 — 03.01.2028.
      const task = makeTask({ date: '2026-12-28', endDate: '2027-01-03', repeat: 'yearly' });
      expect(getMultiDayOccurrence(task, '2028-01-02')).toEqual({
        startStr: '2027-12-28', endStr: '2028-01-03',
      });
    });

    it('custom monthly interval: calendar-aligned end (every 3 months)', () => {
      const task = makeTask({
        date: '2026-01-28', endDate: '2026-02-03', repeat: 'custom',
        repeatConfig: { every: 3, unit: 'month' },
      });
      // +3 months: 28.04 — 03.05 (вместо 28.04 + 6 дней = 04.05)
      expect(getMultiDayOccurrence(task, '2026-05-02')).toEqual({
        startStr: '2026-04-28', endStr: '2026-05-03',
      });
    });

    it('day-unit custom keeps fixed duration (not calendar-aligned)', () => {
      const task = makeTask({
        date: '2026-01-01', endDate: '2026-01-03', repeat: 'custom',
        repeatConfig: { every: 5, unit: 'day' },
      });
      // Next: 06.01 — 08.01 (duration 2 days preserved)
      expect(getMultiDayOccurrence(task, '2026-01-06')).toEqual({
        startStr: '2026-01-06', endStr: '2026-01-08',
      });
    });

    it('Bug 5 fix: monthly start day clamped to last day of short month (Feb 29 → Feb 28)', () => {
      // 2026 — невисокосный, Feb 29 не существует.
      // Задача 29.01 — 03.02. 2-е вхождение должно быть 28.02 (а не 01.03 из-за JS rollover).
      const task = makeTask({ date: '2026-01-29', endDate: '2026-02-03', repeat: 'monthly' });
      expect(getMultiDayOccurrence(task, '2026-03-01')).toEqual({
        startStr: '2026-02-28', endStr: '2026-03-03',
      });
    });

    it('Bug 5 fix: monthly start day clamped to last day of short month (day 31)', () => {
      // 31.01 в feb→clamp до 28. 3-е вхождение (Apr 2026) → 31 → April has 30 → clamp 30.
      const task = makeTask({ date: '2026-01-31', endDate: '2026-02-02', repeat: 'monthly' });
      // 2-е вхождение: 28.02 — 02.03 (clamped Feb 31 → Feb 28)
      expect(getMultiDayOccurrence(task, '2026-03-01')).toEqual({
        startStr: '2026-02-28', endStr: '2026-03-02',
      });
      // 3-е вхождение: 31.03 — 02.04 (Mar has 31)
      expect(getMultiDayOccurrence(task, '2026-04-01')).toEqual({
        startStr: '2026-03-31', endStr: '2026-04-02',
      });
    });

    it('Bug 5 fix: yearly Feb 29 → Feb 28 in non-leap year', () => {
      // 2024 — високосный, есть 29 февраля. 2025 — нет (28 февраля).
      const task = makeTask({ date: '2024-02-29', endDate: '2024-03-02', repeat: 'yearly' });
      expect(getMultiDayOccurrence(task, '2025-03-01')).toEqual({
        startStr: '2025-02-28', endStr: '2025-03-02',
      });
    });
  });
});

// ──────────────────────────────────────────────────────────────
// 5. getTasksForDate — basic / predefined repeats
// ──────────────────────────────────────────────────────────────

describe('getTasksForDate — single-day & predefined repeats', () => {
  it('returns task on its exact date', () => {
    const t = makeTask({ date: '2026-01-01' });
    expect(getTasksForDate([t], d('2026-01-01'))).toHaveLength(1);
  });

  it('returns empty on different date with repeat=none', () => {
    const t = makeTask({ date: '2026-01-01' });
    expect(getTasksForDate([t], d('2026-01-02'))).toHaveLength(0);
  });

  it('returns empty when date is before task start', () => {
    const t = makeTask({ date: '2026-01-05' });
    expect(getTasksForDate([t], d('2026-01-01'))).toHaveLength(0);
  });

  describe('daily repeat', () => {
    const t = makeTask({ date: '2026-01-01', repeat: 'daily' });
    it('matches every day after start', () => {
      expect(getTasksForDate([t], d('2026-01-10'))).toHaveLength(1);
      expect(getTasksForDate([t], d('2026-02-15'))).toHaveLength(1);
    });
  });

  describe('weekdays repeat', () => {
    const t = makeTask({ date: '2026-01-05', repeat: 'weekdays' }); // Mon
    it('matches weekdays Mon-Fri', () => {
      expect(getTasksForDate([t], d('2026-01-06'))).toHaveLength(1); // Tue
      expect(getTasksForDate([t], d('2026-01-09'))).toHaveLength(1); // Fri
    });
    it('does not match Sat/Sun', () => {
      expect(getTasksForDate([t], d('2026-01-10'))).toHaveLength(0); // Sat
      expect(getTasksForDate([t], d('2026-01-11'))).toHaveLength(0); // Sun
    });
  });

  describe('weekly repeat', () => {
    const t = makeTask({ date: '2026-01-05', repeat: 'weekly' }); // Mon
    it('matches same day of week', () => {
      expect(getTasksForDate([t], d('2026-01-12'))).toHaveLength(1);
      expect(getTasksForDate([t], d('2026-01-19'))).toHaveLength(1);
    });
    it('does not match other days', () => {
      expect(getTasksForDate([t], d('2026-01-13'))).toHaveLength(0);
    });
  });

  describe('monthly repeat', () => {
    const t = makeTask({ date: '2026-01-15', repeat: 'monthly' });
    it('matches same day of month', () => {
      expect(getTasksForDate([t], d('2026-02-15'))).toHaveLength(1);
      expect(getTasksForDate([t], d('2026-03-15'))).toHaveLength(1);
    });
    it('does not match other days', () => {
      expect(getTasksForDate([t], d('2026-02-14'))).toHaveLength(0);
    });
  });

  describe('yearly repeat', () => {
    const t = makeTask({ date: '2026-12-25', repeat: 'yearly' });
    it('matches same date next year', () => {
      expect(getTasksForDate([t], d('2027-12-25'))).toHaveLength(1);
    });
  });

  describe('repeatUntil cutoff', () => {
    it('stops repeating after repeatUntil for single-day task', () => {
      const t = makeTask({ date: '2026-01-01', repeat: 'daily', repeatUntil: '2026-01-05' });
      expect(getTasksForDate([t], d('2026-01-05'))).toHaveLength(1);
      expect(getTasksForDate([t], d('2026-01-06'))).toHaveLength(0);
    });
  });

  describe('completion status', () => {
    it('marks task as done when completion exists', () => {
      const t = makeTask({ date: '2026-01-01', repeat: 'daily' });
      const completions = new Set([completionKey('t1', '2026-01-05')]);
      const result = getTasksForDate([t], d('2026-01-05'), completions);
      expect(result[0].status).toBe('done');
    });
    it('marks task as pending without completion', () => {
      const t = makeTask({ date: '2026-01-01', repeat: 'daily' });
      const result = getTasksForDate([t], d('2026-01-05'));
      expect(result[0].status).toBe('pending');
    });
  });
});

// ──────────────────────────────────────────────────────────────
// 6. getTasksForDate — custom interval / cyclic / dependency
// ──────────────────────────────────────────────────────────────

describe('getTasksForDate — custom modes', () => {
  describe('custom interval', () => {
    it('every 2 days', () => {
      const t = makeTask({
        date: '2026-01-01', repeat: 'custom',
        repeatConfig: { every: 2, unit: 'day' },
      });
      expect(getTasksForDate([t], d('2026-01-01'))).toHaveLength(1); // orig
      expect(getTasksForDate([t], d('2026-01-02'))).toHaveLength(0);
      expect(getTasksForDate([t], d('2026-01-03'))).toHaveLength(1);
      expect(getTasksForDate([t], d('2026-01-05'))).toHaveLength(1);
    });

    it('every week on specific weekdays', () => {
      const t = makeTask({
        date: '2026-01-05', repeat: 'custom', // Mon
        repeatConfig: { every: 1, unit: 'week', weekdays: [1, 3, 5] }, // Mon/Wed/Fri
      });
      expect(getTasksForDate([t], d('2026-01-07'))).toHaveLength(1); // Wed
      expect(getTasksForDate([t], d('2026-01-09'))).toHaveLength(1); // Fri
      expect(getTasksForDate([t], d('2026-01-08'))).toHaveLength(0); // Thu
    });

    it('skipWeekends flag', () => {
      const t = makeTask({
        date: '2026-01-05', repeat: 'custom', // Mon
        repeatConfig: { every: 1, unit: 'day', skipWeekends: true },
      });
      expect(getTasksForDate([t], d('2026-01-10'))).toHaveLength(0); // Sat
      expect(getTasksForDate([t], d('2026-01-12'))).toHaveLength(1); // Mon
    });
  });

  describe('cyclic pattern', () => {
    // [2 active, 2 rest, 3 active, 1 rest, 4 active] — 12-day cycle, 9 active days
    const t = makeTask({
      date: '2026-01-01', repeat: 'custom',
      repeatConfig: {
        cyclicPattern: [
          { active: 2, rest: 2 },
          { active: 3, rest: 1 },
          { active: 4, rest: 0 },
        ],
      },
    });

    it('matches first 2 active days', () => {
      expect(getTasksForDate([t], d('2026-01-01'))).toHaveLength(1);
      expect(getTasksForDate([t], d('2026-01-02'))).toHaveLength(1);
    });
    it('does not match rest days 3-4', () => {
      expect(getTasksForDate([t], d('2026-01-03'))).toHaveLength(0);
      expect(getTasksForDate([t], d('2026-01-04'))).toHaveLength(0);
    });
    it('matches next 3 active days (5-7)', () => {
      expect(getTasksForDate([t], d('2026-01-05'))).toHaveLength(1);
      expect(getTasksForDate([t], d('2026-01-07'))).toHaveLength(1);
    });
    it('matches the rest day (8)', () => {
      expect(getTasksForDate([t], d('2026-01-08'))).toHaveLength(0);
    });
    it('matches last 4 active days (9-12)', () => {
      expect(getTasksForDate([t], d('2026-01-09'))).toHaveLength(1);
      expect(getTasksForDate([t], d('2026-01-12'))).toHaveLength(1);
    });
    it('repeats after 12-day cycle', () => {
      // Jan 13 = day 12 (0-based), cycle restarts. Days 12-13 active.
      expect(getTasksForDate([t], d('2026-01-13'))).toHaveLength(1);
      expect(getTasksForDate([t], d('2026-01-14'))).toHaveLength(1);
      expect(getTasksForDate([t], d('2026-01-15'))).toHaveLength(0);
    });
  });

  describe('dependency mode', () => {
    const baseTask = makeTask({
      date: '2026-01-01', repeat: 'custom',
      repeatConfig: { dependencyDays: 7 },
    });

    it('shows from start when no completions', () => {
      expect(getTasksForDate([baseTask], d('2026-01-01'))).toHaveLength(1);
      expect(getTasksForDate([baseTask], d('2026-01-05'))).toHaveLength(1);
    });

    it('hides for 7 days after completion', () => {
      const completions = new Set([completionKey('t1', '2026-01-01')]);
      expect(getTasksForDate([baseTask], d('2026-01-02'), completions)).toHaveLength(0);
      expect(getTasksForDate([baseTask], d('2026-01-07'), completions)).toHaveLength(0);
    });

    it('shows again exactly 7 days after completion', () => {
      const completions = new Set([completionKey('t1', '2026-01-01')]);
      expect(getTasksForDate([baseTask], d('2026-01-08'), completions)).toHaveLength(1);
    });

    it('shows on completion day itself (as done)', () => {
      const completions = new Set([completionKey('t1', '2026-01-01')]);
      const result = getTasksForDate([baseTask], d('2026-01-01'), completions);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('done');
    });
  });
});

// ──────────────────────────────────────────────────────────────
// 7. Conflict #1 — endAfter enforcement
// ──────────────────────────────────────────────────────────────

describe('endAfter enforcement (Conflict #1 fix)', () => {
  describe('interval mode', () => {
    const t = makeTask({
      date: '2026-01-01', repeat: 'custom',
      repeatConfig: { every: 1, unit: 'day', endAfter: 3 },
    });
    it('shows first 3 days', () => {
      expect(getTasksForDate([t], d('2026-01-01'))).toHaveLength(1);
      expect(getTasksForDate([t], d('2026-01-02'))).toHaveLength(1);
      expect(getTasksForDate([t], d('2026-01-03'))).toHaveLength(1);
    });
    it('hides from 4th day', () => {
      expect(getTasksForDate([t], d('2026-01-04'))).toHaveLength(0);
      expect(getTasksForDate([t], d('2026-01-10'))).toHaveLength(0);
    });
  });

  describe('cyclic mode', () => {
    // Pattern [{2,1}] — 2 active, 1 rest. endAfter=5 → only first 5 active days
    const t = makeTask({
      date: '2026-01-01', repeat: 'custom',
      repeatConfig: { cyclicPattern: [{ active: 2, rest: 1 }], endAfter: 5 },
    });
    it('shows up to 5 active days (1,2,4,5,7)', () => {
      expect(getTasksForDate([t], d('2026-01-01'))).toHaveLength(1); // idx 1
      expect(getTasksForDate([t], d('2026-01-02'))).toHaveLength(1); // idx 2
      expect(getTasksForDate([t], d('2026-01-04'))).toHaveLength(1); // idx 3
      expect(getTasksForDate([t], d('2026-01-05'))).toHaveLength(1); // idx 4
      expect(getTasksForDate([t], d('2026-01-07'))).toHaveLength(1); // idx 5
    });
    it('hides 6th active day', () => {
      expect(getTasksForDate([t], d('2026-01-08'))).toHaveLength(0); // would be idx 6
    });
  });

  describe('dependency mode', () => {
    const t = makeTask({
      date: '2026-01-01', repeat: 'custom',
      repeatConfig: { dependencyDays: 3, endAfter: 2 },
    });

    it('allows first 2 occurrences (1 completion + current)', () => {
      const completions = new Set([completionKey('t1', '2026-01-01')]);
      // Day 4: 3 days after completion, occurrence #2 in progress
      expect(getTasksForDate([t], d('2026-01-04'), completions)).toHaveLength(1);
    });

    it('hides after 2 completions', () => {
      const completions = new Set([
        completionKey('t1', '2026-01-01'),
        completionKey('t1', '2026-01-04'),
      ]);
      // Day 7: would be 3rd occurrence
      expect(getTasksForDate([t], d('2026-01-07'), completions)).toHaveLength(0);
    });
  });

  describe('predefined daily mode', () => {
    // endAfter on predefined repeats: only works if repeatConfig is set
    // Otherwise no limit. Test that limit applies via custom config.
    const t = makeTask({
      date: '2026-01-01', repeat: 'custom',
      repeatConfig: { every: 1, unit: 'day', endAfter: 5 },
    });
    it('limits to 5 occurrences', () => {
      expect(getTasksForDate([t], d('2026-01-05'))).toHaveLength(1);
      expect(getTasksForDate([t], d('2026-01-06'))).toHaveLength(0);
    });
  });
});

// ──────────────────────────────────────────────────────────────
// 8. Multi-day tasks
// ──────────────────────────────────────────────────────────────

describe('getTasksForDate — multi-day tasks', () => {
  it('shows all days of original multi-day range', () => {
    const t = makeTask({ date: '2026-01-01', endDate: '2026-01-03' });
    expect(getTasksForDate([t], d('2026-01-01'))).toHaveLength(1);
    expect(getTasksForDate([t], d('2026-01-02'))).toHaveLength(1);
    expect(getTasksForDate([t], d('2026-01-03'))).toHaveLength(1);
    expect(getTasksForDate([t], d('2026-01-04'))).toHaveLength(0);
  });

  it('shows weekly repeating multi-day on next occurrence', () => {
    const t = makeTask({ date: '2026-01-05', endDate: '2026-01-07', repeat: 'weekly' });
    expect(getTasksForDate([t], d('2026-01-12'))).toHaveLength(1);
    expect(getTasksForDate([t], d('2026-01-14'))).toHaveLength(1);
    expect(getTasksForDate([t], d('2026-01-15'))).toHaveLength(0);
  });

  it('shows custom interval multi-day (Conflict #2 fix)', () => {
    const t = makeTask({
      date: '2026-01-01', endDate: '2026-01-03', repeat: 'custom',
      repeatConfig: { every: 2, unit: 'week' },
    });
    expect(getTasksForDate([t], d('2026-01-15'))).toHaveLength(1); // start of next occ
    expect(getTasksForDate([t], d('2026-01-17'))).toHaveLength(1); // end of next occ
    expect(getTasksForDate([t], d('2026-01-08'))).toHaveLength(0); // off-week
  });

  it('respects repeatUntil for whole occurrence (Conflict #3 fix)', () => {
    // Jan 1 2026 = Thursday. Weekly: next 5-day occ would be Jan 8-12.
    const t = makeTask({
      date: '2026-01-01', endDate: '2026-01-05', repeat: 'weekly',
      repeatUntil: '2026-01-11', // 12 > 11 → skip whole occ
    });
    expect(getTasksForDate([t], d('2026-01-09'))).toHaveLength(0);
    expect(getTasksForDate([t], d('2026-01-10'))).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────
// 9. Conditions — months, holidays, weather
// ──────────────────────────────────────────────────────────────

describe('getTasksForDate — conditions', () => {
  describe('months filter (seasonal)', () => {
    const t = makeTask({
      date: '2026-01-15', repeat: 'custom',
      repeatConfig: { every: 1, unit: 'day', months: [6, 7, 8] },
    });

    it('hides outside selected months', () => {
      expect(getTasksForDate([t], d('2026-03-15'))).toHaveLength(0);
      expect(getTasksForDate([t], d('2026-05-31'))).toHaveLength(0);
    });
    it('shows inside selected months', () => {
      expect(getTasksForDate([t], d('2026-06-15'))).toHaveLength(1);
      expect(getTasksForDate([t], d('2026-08-31'))).toHaveLength(1);
    });
    it('hides original day if outside selected months', () => {
      // Jan 15 (task.date) but months=[6,7,8] → hidden
      expect(getTasksForDate([t], d('2026-01-15'))).toHaveLength(0);
    });
  });

  describe('holiday filter', () => {
    const holidayMap = new Map([['2026-01-07', { type: 'holiday' }]]);
    const t = makeTask({
      date: '2026-01-01', repeat: 'custom',
      repeatConfig: { every: 1, unit: 'day', holidaySettings: { skipHolidays: true } },
    });

    it('hides on holiday', () => {
      expect(getTasksForDate([t], d('2026-01-07'), new Set(), holidayMap)).toHaveLength(0);
    });
    it('shows on non-holiday', () => {
      expect(getTasksForDate([t], d('2026-01-08'), new Set(), holidayMap)).toHaveLength(1);
    });
    it('shows on holiday when no map provided', () => {
      expect(getTasksForDate([t], d('2026-01-07'))).toHaveLength(1);
    });
  });

  describe('weather filter', () => {
    const weatherMap = new Map([
      ['2026-01-05', { tempMax: 20, tempMin: 10, weatherCode: 61 }], // rain
      ['2026-01-06', { tempMax: 20, tempMin: 10, weatherCode: 0  }], // clear
    ]);
    const t = makeTask({
      date: '2026-01-01', repeat: 'custom',
      repeatConfig: { every: 1, unit: 'day', weatherCondition: { skipRain: true } },
    });

    it('hides on rainy day', () => {
      expect(getTasksForDate([t], d('2026-01-05'), new Set(), null, weatherMap)).toHaveLength(0);
    });
    it('shows on clear day', () => {
      expect(getTasksForDate([t], d('2026-01-06'), new Set(), null, weatherMap)).toHaveLength(1);
    });
    it('hides when no weather data (strict)', () => {
      // Previously lenient. Now: weather-conditioned tasks hide when forecast unavailable.
      expect(getTasksForDate([t], d('2026-01-10'), new Set(), null, weatherMap)).toHaveLength(0);
    });
  });
});

// ──────────────────────────────────────────────────────────────
// 12. Weather tolerance ±2°C — warning surfaced via task.weatherWarning
// ──────────────────────────────────────────────────────────────

describe('weather tolerance ±2°C', () => {
  const makeWeatherTask = (cond: any) => makeTask({
    date: '2026-01-01', repeat: 'custom',
    repeatConfig: { every: 1, unit: 'day', weatherCondition: cond },
  });

  it('shows without warning when temp in strict range', () => {
    const t = makeWeatherTask({ minTempDay: 20, maxTempDay: 30 });
    const wm = new Map([['2026-01-05', { tempMax: 25, tempMin: 10, weatherCode: 0 }]]);
    const r = getTasksForDate([t], d('2026-01-05'), new Set(), null, wm);
    expect(r).toHaveLength(1);
    expect(r[0].weatherWarning).toBeUndefined();
  });

  it('shows with warning when 1°C below minTempDay (within tolerance)', () => {
    const t = makeWeatherTask({ minTempDay: 20 });
    const wm = new Map([['2026-01-05', { tempMax: 19, tempMin: 10, weatherCode: 0 }]]);
    const r = getTasksForDate([t], d('2026-01-05'), new Set(), null, wm);
    expect(r).toHaveLength(1);
    expect(r[0].weatherWarning).toBeDefined();
    expect(r[0].weatherWarning).toContain('19');
  });

  it('hides when 3°C below minTempDay (outside tolerance)', () => {
    const t = makeWeatherTask({ minTempDay: 20 });
    const wm = new Map([['2026-01-05', { tempMax: 17, tempMin: 10, weatherCode: 0 }]]);
    expect(getTasksForDate([t], d('2026-01-05'), new Set(), null, wm)).toHaveLength(0);
  });

  it('shows with warning when 1°C above maxTempDay', () => {
    const t = makeWeatherTask({ maxTempDay: 25 });
    const wm = new Map([['2026-01-05', { tempMax: 26, tempMin: 10, weatherCode: 0 }]]);
    const r = getTasksForDate([t], d('2026-01-05'), new Set(), null, wm);
    expect(r).toHaveLength(1);
    expect(r[0].weatherWarning).toContain('26');
  });

  it('discrete conditions (skipRain) — no tolerance, strict reject', () => {
    const t = makeWeatherTask({ skipRain: true });
    const wm = new Map([['2026-01-05', { tempMax: 20, tempMin: 10, weatherCode: 61 }]]);
    expect(getTasksForDate([t], d('2026-01-05'), new Set(), null, wm)).toHaveLength(0);
  });

  it('shows with combined warnings (day + night both borderline)', () => {
    const t = makeWeatherTask({ minTempDay: 20, minTempNight: 10 });
    const wm = new Map([['2026-01-05', { tempMax: 19, tempMin: 9, weatherCode: 0 }]]);
    const r = getTasksForDate([t], d('2026-01-05'), new Set(), null, wm);
    expect(r).toHaveLength(1);
    expect(r[0].weatherWarning).toContain('днём');
    expect(r[0].weatherWarning).toContain('ночью');
  });
});

// ──────────────────────────────────────────────────────────────
// 13. Weather no-data: strict hide rule
// ──────────────────────────────────────────────────────────────

describe('weather no-data behavior (strict hide)', () => {
  const t = makeTask({
    date: '2026-01-01', repeat: 'custom',
    repeatConfig: { every: 1, unit: 'day', weatherCondition: { skipRain: true } },
  });

  it('hides when weatherMap is null', () => {
    expect(getTasksForDate([t], d('2026-01-05'))).toHaveLength(0);
  });

  it('hides when date has no entry in weatherMap', () => {
    const wm = new Map([['2026-01-04', { tempMax: 20, tempMin: 10, weatherCode: 0 }]]);
    expect(getTasksForDate([t], d('2026-01-05'), new Set(), null, wm)).toHaveLength(0);
  });

  it('shows when data later becomes available and matches', () => {
    let wm = new Map<string, any>(); // initially empty
    expect(getTasksForDate([t], d('2026-01-05'), new Set(), null, wm)).toHaveLength(0);
    // Later: forecast comes in, clear weather
    wm = new Map([['2026-01-05', { tempMax: 20, tempMin: 10, weatherCode: 0 }]]);
    expect(getTasksForDate([t], d('2026-01-05'), new Set(), null, wm)).toHaveLength(1);
  });

  it('non-weather tasks unaffected by missing weather data', () => {
    const tNoCond = makeTask({ date: '2026-01-01', repeat: 'daily' });
    expect(getTasksForDate([tNoCond], d('2026-01-05'))).toHaveLength(1);
  });
});

// ──────────────────────────────────────────────────────────────
// 14. Weather "shown lock" for past / today
// ──────────────────────────────────────────────────────────────

describe('weather shown lock (past/today persistence)', () => {
  const t = makeTask({
    date: '2026-01-01', repeat: 'custom',
    repeatConfig: { every: 1, unit: 'day', weatherCondition: { skipRain: true } },
  });

  it('locks today after first successful show; survives weather worsening', () => {
    const todayStr = '2026-01-05';
    const lock = new Set<string>();

    // Clear weather → shown, lock set
    let wm = new Map([[todayStr, { tempMax: 20, tempMin: 10, weatherCode: 0 }]]);
    let r = getTasksForDate([t], d(todayStr), new Set(), null, wm, { todayStr, weatherShownLock: lock });
    expect(r).toHaveLength(1);
    expect(lock.has('t1__2026-01-05')).toBe(true);

    // Weather later turns rainy → still shown (locked), with warning
    wm = new Map([[todayStr, { tempMax: 20, tempMin: 10, weatherCode: 61 }]]);
    r = getTasksForDate([t], d(todayStr), new Set(), null, wm, { todayStr, weatherShownLock: lock });
    expect(r).toHaveLength(1);
    expect(r[0].weatherWarning).toContain('Погода ухудшилась');
  });

  it('does NOT lock for future dates (beyond today)', () => {
    const todayStr = '2026-01-05';
    const futureStr = '2026-02-01';
    const lock = new Set<string>();

    // Future clear → shown, NOT locked
    let wm = new Map([[futureStr, { tempMax: 20, tempMin: 10, weatherCode: 0 }]]);
    let r = getTasksForDate([t], d(futureStr), new Set(), null, wm, { todayStr, weatherShownLock: lock });
    expect(r).toHaveLength(1);
    expect(lock.size).toBe(0);

    // Future weather turns rainy → hidden (no lock for future)
    wm = new Map([[futureStr, { tempMax: 20, tempMin: 10, weatherCode: 61 }]]);
    r = getTasksForDate([t], d(futureStr), new Set(), null, wm, { todayStr, weatherShownLock: lock });
    expect(r).toHaveLength(0);
  });

  it('failed today is dynamic: weather improves → shows again', () => {
    const todayStr = '2026-01-05';
    const lock = new Set<string>();

    // Initially rainy → hidden, lock empty
    let wm = new Map([[todayStr, { tempMax: 20, tempMin: 10, weatherCode: 61 }]]);
    let r = getTasksForDate([t], d(todayStr), new Set(), null, wm, { todayStr, weatherShownLock: lock });
    expect(r).toHaveLength(0);
    expect(lock.size).toBe(0);

    // Forecast updates → clear → shown
    wm = new Map([[todayStr, { tempMax: 20, tempMin: 10, weatherCode: 0 }]]);
    r = getTasksForDate([t], d(todayStr), new Set(), null, wm, { todayStr, weatherShownLock: lock });
    expect(r).toHaveLength(1);
    expect(lock.size).toBe(1);
  });

  it('past dates also lock once shown', () => {
    const todayStr = '2026-01-10';
    const pastStr = '2026-01-05';
    const lock = new Set<string>();

    // Past day with clear weather → shown, locked
    let wm = new Map([[pastStr, { tempMax: 20, tempMin: 10, weatherCode: 0 }]]);
    let r = getTasksForDate([t], d(pastStr), new Set(), null, wm, { todayStr, weatherShownLock: lock });
    expect(r).toHaveLength(1);
    expect(lock.has(`t1__${pastStr}`)).toBe(true);

    // Even if past archive data updated to rain (unlikely but possible), still shown
    wm = new Map([[pastStr, { tempMax: 20, tempMin: 10, weatherCode: 61 }]]);
    r = getTasksForDate([t], d(pastStr), new Set(), null, wm, { todayStr, weatherShownLock: lock });
    expect(r).toHaveLength(1);
  });
});

// ──────────────────────────────────────────────────────────────
// 10. Conflict #4 — conditionScope perDay/whole
// ──────────────────────────────────────────────────────────────

describe('conditionScope — perDay vs whole (Conflict #4 fix)', () => {
  const holidayMap = new Map([['2026-01-02', { type: 'holiday' }]]);
  // 3-day task Jan 1-3, day 2 is a holiday

  it('perDay (default): hides only the holiday day', () => {
    const t = makeTask({
      date: '2026-01-01', endDate: '2026-01-03',
      repeatConfig: { holidaySettings: { skipHolidays: true } },
    });
    expect(getTasksForDate([t], d('2026-01-01'), new Set(), holidayMap)).toHaveLength(1);
    expect(getTasksForDate([t], d('2026-01-02'), new Set(), holidayMap)).toHaveLength(0);
    expect(getTasksForDate([t], d('2026-01-03'), new Set(), holidayMap)).toHaveLength(1);
  });

  it('whole: hides entire block if any day is a holiday', () => {
    const t = makeTask({
      date: '2026-01-01', endDate: '2026-01-03',
      repeatConfig: {
        holidaySettings: { skipHolidays: true },
        conditionScope: 'whole',
      },
    });
    expect(getTasksForDate([t], d('2026-01-01'), new Set(), holidayMap)).toHaveLength(0);
    expect(getTasksForDate([t], d('2026-01-02'), new Set(), holidayMap)).toHaveLength(0);
    expect(getTasksForDate([t], d('2026-01-03'), new Set(), holidayMap)).toHaveLength(0);
  });

  it('whole: shows entire block when all days pass', () => {
    const cleanMap = new Map([['2026-01-09', { type: 'holiday' }]]);
    const t = makeTask({
      date: '2026-01-01', endDate: '2026-01-03',
      repeatConfig: {
        holidaySettings: { skipHolidays: true },
        conditionScope: 'whole',
      },
    });
    expect(getTasksForDate([t], d('2026-01-01'), new Set(), cleanMap)).toHaveLength(1);
    expect(getTasksForDate([t], d('2026-01-02'), new Set(), cleanMap)).toHaveLength(1);
    expect(getTasksForDate([t], d('2026-01-03'), new Set(), cleanMap)).toHaveLength(1);
  });

  it('whole with weather: blocks entire week if any day rains', () => {
    const weatherMap = new Map([
      ['2026-01-01', { tempMax: 20, tempMin: 10, weatherCode: 0  }],
      ['2026-01-02', { tempMax: 20, tempMin: 10, weatherCode: 61 }], // rain
      ['2026-01-03', { tempMax: 20, tempMin: 10, weatherCode: 0  }],
    ]);
    const t = makeTask({
      date: '2026-01-01', endDate: '2026-01-03',
      repeatConfig: {
        weatherCondition: { skipRain: true },
        conditionScope: 'whole',
      },
    });
    expect(getTasksForDate([t], d('2026-01-01'), new Set(), null, weatherMap)).toHaveLength(0);
    expect(getTasksForDate([t], d('2026-01-03'), new Set(), null, weatherMap)).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────
// 11. Sorting & multiple tasks
// ──────────────────────────────────────────────────────────────

describe('getTasksForDate — sorting & multiple tasks', () => {
  it('sorts tasks by time (untimed last)', () => {
    const tasks: Task[] = [
      makeTask({ id: 'a', date: '2026-01-01' }),                 // no time → 99:99
      makeTask({ id: 'b', date: '2026-01-01', time: '08:00' }),
      makeTask({ id: 'c', date: '2026-01-01', time: '14:30' }),
    ];
    const result = getTasksForDate(tasks, d('2026-01-01'));
    expect(result.map(r => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('aggregates matching tasks across repeat modes', () => {
    const tasks: Task[] = [
      makeTask({ id: 'a', date: '2026-01-01', repeat: 'daily' }),
      makeTask({ id: 'b', date: '2026-01-15', repeat: 'monthly' }),
      makeTask({ id: 'c', date: '2026-02-15' }),
    ];
    const result = getTasksForDate(tasks, d('2026-02-15'));
    expect(result).toHaveLength(3);
  });
});
