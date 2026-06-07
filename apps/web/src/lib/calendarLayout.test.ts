import { describe, it, expect } from 'vitest';
import type { Task } from './tasks';
import type { Tag } from './tags';
import {
  pad, getISOWeek, luminance, taskColorStyle, taskBlockHeight,
  isRepeatMultiDayActiveOn, taskActiveOn, computeLayout,
  getWeekDays, buildCells, buildWeeks, computeWeekSpans, computeMonthSpans,
} from './calendarLayout';

function mkTag(color: string): Tag {
  return { id: 't', name: 'x', icon: null, color };
}

function mkTask(over: Partial<Task> & { id: string; date: string }): Task {
  return {
    title: 'T',
    status: 'pending',
    repeat: 'none',
    type: 'normal',
    ...over,
  } as Task;
}

describe('pad', () => {
  it('pads single digit with leading zero', () => {
    expect(pad(5)).toBe('05');
    expect(pad(12)).toBe('12');
  });
});

describe('getISOWeek', () => {
  it('returns ISO week number', () => {
    expect(getISOWeek(new Date(2026, 0, 1))).toBe(1);
    expect(getISOWeek(new Date(2026, 5, 8))).toBe(24);
  });
});

describe('luminance', () => {
  it('computes relative luminance for hex colors', () => {
    expect(luminance('#ffffff')).toBeCloseTo(1, 5);
    expect(luminance('#000000')).toBeCloseTo(0, 5);
  });

  it('returns 0.5 fallback for malformed hex', () => {
    expect(luminance('#fff')).toBe(0.5);
    expect(luminance('not-a-color')).toBe(0.5);
  });
});

describe('taskColorStyle', () => {
  it('uses tag color when present, choosing text color by luminance', () => {
    const light = mkTask({ id: '1', date: '2026-06-01', tags: [mkTag('#ffffff')] });
    expect(taskColorStyle(light)).toMatchObject({ background: '#ffffff', color: '#1a1a1a' });

    const dark = mkTask({ id: '2', date: '2026-06-01', tags: [mkTag('#000000')] });
    expect(taskColorStyle(dark)).toMatchObject({ background: '#000000', color: '#fff' });
  });

  it('falls back to type-based colors when no tag', () => {
    expect(taskColorStyle(mkTask({ id: '1', date: '2026-06-01', type: 'mandatory' }))).toMatchObject({ background: '#c2410c' });
    expect(taskColorStyle(mkTask({ id: '2', date: '2026-06-01', type: 'event' }))).toMatchObject({ background: '#1e3a8a' });
    expect(taskColorStyle(mkTask({ id: '3', date: '2026-06-01', type: 'normal' }))).toBeUndefined();
  });
});

describe('taskBlockHeight', () => {
  it('returns all-day height when no time set', () => {
    expect(taskBlockHeight(mkTask({ id: '1', date: '2026-06-01' }))).toBe(22);
  });

  it('computes height from duration when endTime is set', () => {
    const t = mkTask({ id: '1', date: '2026-06-01', time: '10:00', endTime: '12:00' });
    expect(taskBlockHeight(t)).toBe(2 * 52);
  });

  it('clamps very short durations to a minimum', () => {
    const t = mkTask({ id: '1', date: '2026-06-01', time: '10:00', endTime: '10:05' });
    expect(taskBlockHeight(t)).toBe(24);
  });

  it('falls back to default TASK_H when no endTime or non-positive duration', () => {
    const t1 = mkTask({ id: '1', date: '2026-06-01', time: '10:00' });
    expect(taskBlockHeight(t1)).toBe(34);
    const t2 = mkTask({ id: '2', date: '2026-06-01', time: '10:00', endTime: '09:00' });
    expect(taskBlockHeight(t2)).toBe(34);
  });
});

describe('isRepeatMultiDayActiveOn', () => {
  it('returns false when date is past repeatUntil', () => {
    const t = mkTask({ id: '1', date: '2026-06-01', endDate: '2026-06-03', repeat: 'daily', repeatUntil: '2026-06-10' });
    expect(isRepeatMultiDayActiveOn(t, '2026-06-15')).toBe(false);
  });

  it('returns true for an occurrence whose start is after the original task date', () => {
    const t = mkTask({ id: '1', date: '2026-06-01', endDate: '2026-06-03', repeat: 'daily' });
    // occurrence starting 2026-06-08 (start > original date 2026-06-01) and 06-09 falls within it
    expect(isRepeatMultiDayActiveOn(t, '2026-06-09')).toBe(true);
  });

  it('returns false for the original occurrence (start === task date)', () => {
    const t = mkTask({ id: '1', date: '2026-06-01', endDate: '2026-06-03', repeat: 'daily' });
    expect(isRepeatMultiDayActiveOn(t, '2026-06-02')).toBe(false);
  });
});

describe('taskActiveOn', () => {
  it('matches single-day task on its own date only', () => {
    const t = mkTask({ id: '1', date: '2026-06-05' });
    expect(taskActiveOn(t, '2026-06-05')).toBe(true);
    expect(taskActiveOn(t, '2026-06-06')).toBe(false);
  });

  it('matches multi-day task across its date range', () => {
    const t = mkTask({ id: '1', date: '2026-06-05', endDate: '2026-06-07' });
    expect(taskActiveOn(t, '2026-06-05')).toBe(true);
    expect(taskActiveOn(t, '2026-06-06')).toBe(true);
    expect(taskActiveOn(t, '2026-06-07')).toBe(true);
    expect(taskActiveOn(t, '2026-06-08')).toBe(false);
  });

  it('multi-day non-repeating task is inactive outside its range', () => {
    const t = mkTask({ id: '1', date: '2026-06-05', endDate: '2026-06-07', repeat: 'none' });
    expect(taskActiveOn(t, '2026-06-12')).toBe(false);
  });

  it('repeats daily', () => {
    const t = mkTask({ id: '1', date: '2026-06-01', repeat: 'daily' });
    expect(taskActiveOn(t, '2026-06-10')).toBe(true);
  });

  it('repeats weekly on the same weekday', () => {
    const t = mkTask({ id: '1', date: '2026-06-01', repeat: 'weekly' }); // Monday
    expect(taskActiveOn(t, '2026-06-08')).toBe(true);  // also Monday
    expect(taskActiveOn(t, '2026-06-09')).toBe(false); // Tuesday
  });

  it('repeats monthly on the same day-of-month', () => {
    const t = mkTask({ id: '1', date: '2026-06-05', repeat: 'monthly' });
    expect(taskActiveOn(t, '2026-07-05')).toBe(true);
    expect(taskActiveOn(t, '2026-07-06')).toBe(false);
  });

  it('repeats yearly on the same day and month', () => {
    const t = mkTask({ id: '1', date: '2026-06-05', repeat: 'yearly' });
    expect(taskActiveOn(t, '2027-06-05')).toBe(true);
    expect(taskActiveOn(t, '2027-07-05')).toBe(false);
  });

  it('respects repeatUntil for single-day repeating tasks', () => {
    const t = mkTask({ id: '1', date: '2026-06-01', repeat: 'daily', repeatUntil: '2026-06-05' });
    expect(taskActiveOn(t, '2026-06-05')).toBe(true);
    expect(taskActiveOn(t, '2026-06-06')).toBe(false);
  });
});

describe('computeLayout', () => {
  it('assigns column 0 to non-overlapping tasks', () => {
    const tasks = [
      mkTask({ id: 'a', date: '2026-06-01', time: '09:00' }),
      mkTask({ id: 'b', date: '2026-06-01', time: '11:00' }),
    ];
    const layout = computeLayout(tasks);
    expect(layout.get('a')).toEqual({ col: 0, totalCols: 1 });
    expect(layout.get('b')).toEqual({ col: 0, totalCols: 1 });
  });

  it('assigns separate columns to overlapping tasks', () => {
    const tasks = [
      mkTask({ id: 'a', date: '2026-06-01', time: '09:00' }),
      mkTask({ id: 'b', date: '2026-06-01', time: '09:10' }),
    ];
    const layout = computeLayout(tasks);
    expect(layout.get('a')!.col).toBe(0);
    expect(layout.get('b')!.col).toBe(1);
    expect(layout.get('a')!.totalCols).toBe(2);
    expect(layout.get('b')!.totalCols).toBe(2);
  });

  it('ignores tasks without a time', () => {
    const tasks = [mkTask({ id: 'a', date: '2026-06-01' })];
    expect(computeLayout(tasks).size).toBe(0);
  });
});

describe('getWeekDays', () => {
  it('returns the Mon..Sun week containing the given date', () => {
    const days = getWeekDays(new Date(2026, 5, 10)); // Wednesday 2026-06-10
    expect(days).toHaveLength(7);
    expect(days[0].getDay()).toBe(1); // Monday
    expect(days[6].getDay()).toBe(0); // Sunday
    expect(days[0].getDate()).toBe(8);
    expect(days[6].getDate()).toBe(14);
  });

  it('handles a Sunday correctly (wraps to previous Monday)', () => {
    const days = getWeekDays(new Date(2026, 5, 14)); // Sunday
    expect(days[0].getDate()).toBe(8);
    expect(days[6].getDate()).toBe(14);
  });
});

describe('buildCells', () => {
  it('pads leading/trailing nulls so length is a multiple of 7', () => {
    const cells = buildCells(2026, 5); // June 2026 starts on Monday
    expect(cells.length % 7).toBe(0);
    expect(cells[0]).toBe(1);
    expect(cells.filter(c => c !== null)).toHaveLength(30);
  });

  it('pads correctly for a month not starting on Monday', () => {
    const cells = buildCells(2026, 6); // July 2026 starts on Wednesday
    expect(cells[0]).toBeNull();
    expect(cells[1]).toBeNull();
    expect(cells[2]).toBe(1);
  });
});

describe('buildWeeks', () => {
  it('returns full Mon..Sun weeks covering the month', () => {
    const weeks = buildWeeks(2026, 5); // June 2026
    expect(weeks.every(w => w.length === 7)).toBe(true);
    // first week starts on Monday and contains June 1
    expect(weeks[0][0].getDay()).toBe(1);
    expect(weeks[0].some(d => d.getDate() === 1 && d.getMonth() === 5)).toBe(true);
    // last week ends on Sunday and contains June 30
    const lastWeek = weeks[weeks.length - 1];
    expect(lastWeek[6].getDay()).toBe(0);
    expect(lastWeek.some(d => d.getDate() === 30 && d.getMonth() === 5)).toBe(true);
  });
});

describe('computeWeekSpans', () => {
  it('places a multi-day task as a single span across its days', () => {
    const weekDays = getWeekDays(new Date(2026, 5, 10)); // Mon 2026-06-08 .. Sun 2026-06-14
    const tasks = [mkTask({ id: 'a', date: '2026-06-09', endDate: '2026-06-11' })];
    const { spans, overflow } = computeWeekSpans(weekDays, tasks);
    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({ startCol: 1, endCol: 3, slot: 0, continuesLeft: false, continuesRight: false });
    expect(overflow.every(n => n === 0)).toBe(true);
  });

  it('stacks overlapping multi-day tasks into separate slots', () => {
    const weekDays = getWeekDays(new Date(2026, 5, 10));
    const tasks = [
      mkTask({ id: 'a', date: '2026-06-08', endDate: '2026-06-12' }),
      mkTask({ id: 'b', date: '2026-06-09', endDate: '2026-06-10' }),
    ];
    const { spans } = computeWeekSpans(weekDays, tasks);
    const a = spans.find(s => s.task.id === 'a')!;
    const b = spans.find(s => s.task.id === 'b')!;
    expect(a.slot).not.toBe(b.slot);
  });

  it('marks continuesLeft/continuesRight when the span touches week boundaries', () => {
    const weekDays = getWeekDays(new Date(2026, 5, 10)); // Mon 2026-06-08 .. Sun 2026-06-14
    const tasks = [mkTask({ id: 'a', date: '2026-06-05', endDate: '2026-06-20' })];
    const { spans } = computeWeekSpans(weekDays, tasks);
    expect(spans[0]).toMatchObject({ startCol: 0, endCol: 6, continuesLeft: true, continuesRight: true });
  });

  it('counts overflow for spans beyond the visible slot limit', () => {
    const weekDays = getWeekDays(new Date(2026, 5, 10));
    const tasks = Array.from({ length: 4 }, (_, i) =>
      mkTask({ id: `t${i}`, date: '2026-06-08', endDate: '2026-06-09' })
    );
    const { spans, overflow } = computeWeekSpans(weekDays, tasks);
    expect(spans.every(s => s.slot < 3)).toBe(true);
    expect(overflow[0]).toBeGreaterThan(0);
    expect(overflow[1]).toBeGreaterThan(0);
  });
});

describe('computeMonthSpans', () => {
  it('places a multi-day task spanning within the month as a single run', () => {
    const tasks = [mkTask({ id: 'a', date: '2026-06-10', endDate: '2026-06-12' })];
    const { spans, overflow } = computeMonthSpans(2026, 5, tasks);
    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({ sd: 10, ed: 12, slot: 0, cL: false, cR: false });
    expect(overflow.every(n => n === 0)).toBe(true);
  });

  it('marks cL/cR when the task extends beyond the month boundaries', () => {
    const tasks = [mkTask({ id: 'a', date: '2026-05-28', endDate: '2026-06-05' })];
    const { spans } = computeMonthSpans(2026, 5, tasks);
    expect(spans[0]).toMatchObject({ sd: 1, ed: 5, cL: true, cR: false });
  });

  it('stacks overlapping tasks into separate slots and tracks overflow beyond the limit', () => {
    const tasks = [
      mkTask({ id: 'a', date: '2026-06-01', endDate: '2026-06-28' }),
      mkTask({ id: 'b', date: '2026-06-02', endDate: '2026-06-03' }),
      mkTask({ id: 'c', date: '2026-06-02', endDate: '2026-06-03' }),
    ];
    const { spans, overflow } = computeMonthSpans(2026, 5, tasks);
    expect(spans.every(s => s.slot < 2)).toBe(true);
    expect(overflow[2]).toBeGreaterThan(0);
    expect(overflow[3]).toBeGreaterThan(0);
  });
});
