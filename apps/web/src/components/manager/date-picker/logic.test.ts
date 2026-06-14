import { describe, it, expect, vi } from 'vitest';
import {
  buildIso, buildGrid, getDateButtonLabel, scRight,
  getNextMonday, getNextSaturday, nearestWeekday,
  normalizeDaySegment, normalizeMonthSegment, normalizeYearSegment,
  getDayCount, rangeIsMonthOrMore, rangeIsYearOrMore,
  getRepeatLabel, buildRepeatOptions,
  fromStr, today0, addDays,
} from './logic';

describe('buildIso', () => {
  it('строит ISO-дату из валидных сегментов', () => {
    expect(buildIso('15', '06', '2026')).toBe('2026-06-15');
    expect(buildIso('01', '01', '2000')).toBe('2000-01-01');
  });

  it('возвращает null для невалидного дня/месяца', () => {
    expect(buildIso('00', '06', '2026')).toBeNull();
    expect(buildIso('32', '06', '2026')).toBeNull();
    expect(buildIso('15', '00', '2026')).toBeNull();
    expect(buildIso('15', '13', '2026')).toBeNull();
  });

  it('возвращает null при переливе дня в следующий месяц (31.02)', () => {
    expect(buildIso('31', '02', '2026')).toBeNull();
    expect(buildIso('30', '02', '2026')).toBeNull();
  });

  it('учитывает високосный год', () => {
    expect(buildIso('29', '02', '2024')).toBe('2024-02-29');
    expect(buildIso('29', '02', '2023')).toBeNull();
  });

  it('отбрасывает года вне диапазона 1000-9999', () => {
    expect(buildIso('15', '06', '999')).toBeNull();
    expect(buildIso('15', '06', '10000')).toBeNull();
  });
});

describe('buildGrid', () => {
  it('возвращает 6 строк по 7 ячеек (месяц с 31 днём, начинающийся в субботу)', () => {
    const grid = buildGrid(2026, 7); // август 2026 — 1-е число выпадает на субботу
    expect(grid.length).toBe(6);
    grid.forEach(row => expect(row.length).toBe(7));
    expect(grid[0][5]?.getDate()).toBe(1);
  });

  it('понедельник — первый день недели', () => {
    const grid = buildGrid(2026, 5); // июнь 2026 — 1-е число выпадает на понедельник
    expect(grid[0][0]?.getDate()).toBe(1);
  });

  it('добавляет null-паддинги в начале и конце для месяца со смещённым первым днём', () => {
    const grid = buildGrid(2026, 1); // февраль 2026 — начинается с воскресенья (смещение)
    expect(grid[0][0]).toBeNull();
    expect(grid[0][6]?.getDate()).toBe(1);
    const flat = grid.flat();
    const last = [...flat].reverse().find(c => c !== null);
    expect(last?.getDate()).toBe(28);
    expect(flat[flat.length - 1]).toBeNull();
  });
});

describe('getDateButtonLabel', () => {
  const t = today0();
  const toStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  it('Вчера/Сегодня/Завтра', () => {
    expect(getDateButtonLabel(toStr(addDays(t, -1)))).toBe('Вчера');
    expect(getDateButtonLabel(toStr(t))).toBe('Сегодня');
    expect(getDateButtonLabel(toStr(addDays(t, 1)))).toBe('Завтра');
  });

  it('обычная дата → "D месяца"', () => {
    // Фиксируем «сегодня», иначе тест падает, когда реальная дата = 14–16 июня
    // (15 июня тогда попадает в Вчера/Сегодня/Завтра).
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0));
    try {
      expect(getDateButtonLabel('2026-06-15')).toBe('15 июня');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('scRight', () => {
  const base = fromStr('2026-06-08'); // понедельник

  it('diff <= 1 → только аббревиатура дня', () => {
    expect(scRight(fromStr('2026-06-08'), base)).toBe('Пн');
    expect(scRight(fromStr('2026-06-09'), base)).toBe('Вт');
  });

  it('diff > 1 → с числом и месяцем', () => {
    expect(scRight(fromStr('2026-06-13'), base)).toBe('Сб 13 июня');
  });
});

describe('getNextMonday / getNextSaturday / nearestWeekday', () => {
  it('getNextMonday — от любого дня недели', () => {
    expect(getNextMonday(fromStr('2026-06-08')).getDate()).toBe(15); // от понедельника → следующий понедельник
    expect(getNextMonday(fromStr('2026-06-07')).getDate()).toBe(8);  // от воскресенья → завтра-понедельник
    expect(getNextMonday(fromStr('2026-06-10')).getDate()).toBe(15); // от среды
  });

  it('getNextSaturday — от любого дня недели', () => {
    expect(getNextSaturday(fromStr('2026-06-08')).getDate()).toBe(13); // от понедельника
    expect(getNextSaturday(fromStr('2026-06-13')).getDate()).toBe(20); // от субботы → следующая суббота
  });

  it('nearestWeekday — выходной сдвигает к будню, будний день не меняется', () => {
    expect(nearestWeekday(fromStr('2026-06-08')).getDate()).toBe(8);  // понедельник
    expect(nearestWeekday(fromStr('2026-06-13')).getDate()).toBe(15); // суббота → понедельник
    expect(nearestWeekday(fromStr('2026-06-14')).getDate()).toBe(15); // воскресенье → понедельник
  });
});

describe('normalizeDaySegment / normalizeMonthSegment', () => {
  it('зажимает день в 01-31 и помечает завершённость при 2 цифрах', () => {
    expect(normalizeDaySegment('0')).toEqual({ value: '0', complete: false });
    expect(normalizeDaySegment('4')).toEqual({ value: '04', complete: true });
    expect(normalizeDaySegment('00')).toEqual({ value: '01', complete: true });
    expect(normalizeDaySegment('35')).toEqual({ value: '31', complete: true });
    expect(normalizeDaySegment('15')).toEqual({ value: '15', complete: true });
  });

  it('зажимает месяц в 01-12 и помечает завершённость при 2 цифрах', () => {
    expect(normalizeMonthSegment('0')).toEqual({ value: '0', complete: false });
    expect(normalizeMonthSegment('2')).toEqual({ value: '02', complete: true });
    expect(normalizeMonthSegment('00')).toEqual({ value: '01', complete: true });
    expect(normalizeMonthSegment('15')).toEqual({ value: '12', complete: true });
    expect(normalizeMonthSegment('11')).toEqual({ value: '11', complete: true });
  });
});

describe('normalizeYearSegment', () => {
  it('оставляет только цифры, максимум 4', () => {
    expect(normalizeYearSegment('2026')).toBe('2026');
    expect(normalizeYearSegment('20266')).toBe('2026');
    expect(normalizeYearSegment('2a0b2c6')).toBe('2026');
  });
});

describe('getDayCount / rangeIsMonthOrMore / rangeIsYearOrMore', () => {
  it('getDayCount — разница в днях между датами', () => {
    expect(getDayCount('2026-06-01', '2026-06-08')).toBe(7);
    expect(getDayCount('2026-06-01', '2026-06-01')).toBe(0);
  });

  it('rangeIsMonthOrMore — учитывает разную длину месяцев', () => {
    expect(rangeIsMonthOrMore('2026-01-15', '2026-02-15')).toBe(true);  // ровно месяц
    expect(rangeIsMonthOrMore('2026-01-15', '2026-02-14')).toBe(false); // на день меньше месяца
    expect(rangeIsMonthOrMore('2026-01-31', '2026-02-28')).toBe(false); // setMonth переливает 31 янв + 1мес → 3 марта
  });

  it('rangeIsYearOrMore — учитывает високосные годы', () => {
    expect(rangeIsYearOrMore('2026-06-01', '2027-06-01')).toBe(true);  // ровно год
    expect(rangeIsYearOrMore('2026-06-01', '2027-05-31')).toBe(false); // на день меньше года
    expect(rangeIsYearOrMore('2024-02-29', '2025-02-28')).toBe(false); // високосный год → перелив на 1 марта 2025
  });
});

const baseRpt = { rptDow: 1, rptWpre: 'в', rptWday: 'понедельник', rptDay: 15, rptMon: 5 };

describe('getRepeatLabel', () => {
  it('none/daily/weekdays', () => {
    expect(getRepeatLabel({ ...baseRpt, repeat: 'none', multiDay: false, repeatConfig: null })).toBe('↻ Повтор');
    expect(getRepeatLabel({ ...baseRpt, repeat: 'daily', multiDay: false, repeatConfig: null })).toBe('↻ Каждый день');
    expect(getRepeatLabel({ ...baseRpt, repeat: 'weekdays', multiDay: false, repeatConfig: null })).toBe('↻ Каждый будний день');
  });

  it('weekly — single и multiDay формулировки', () => {
    expect(getRepeatLabel({ ...baseRpt, repeat: 'weekly', multiDay: false, repeatConfig: null }))
      .toBe('↻ Кажд. нед. в понедельник');
    expect(getRepeatLabel({ ...baseRpt, repeat: 'weekly', multiDay: true, repeatConfig: null }))
      .toBe('↻ Кажд. нед. с понедельника');
  });

  it('monthly — single и multiDay формулировки', () => {
    expect(getRepeatLabel({ ...baseRpt, repeat: 'monthly', multiDay: false, repeatConfig: null }))
      .toBe('↻ Каждое 15 число');
    expect(getRepeatLabel({ ...baseRpt, repeat: 'monthly', multiDay: true, repeatConfig: null }))
      .toBe('↻ С кажд. 15-го числа');
  });

  it('yearly — single и multiDay формулировки', () => {
    expect(getRepeatLabel({ ...baseRpt, repeat: 'yearly', multiDay: false, repeatConfig: null }))
      .toBe('↻ Каждое 15 июня');
    expect(getRepeatLabel({ ...baseRpt, repeat: 'yearly', multiDay: true, repeatConfig: null }))
      .toBe('↻ С кажд. 15 июня');
  });

  it('custom — dependency/cyclic/interval, сезонность', () => {
    expect(getRepeatLabel({ ...baseRpt, repeat: 'custom', multiDay: false, repeatConfig: { dependencyDays: 3 } }))
      .toBe('↻ Через 3 дн. после выполн.');
    expect(getRepeatLabel({ ...baseRpt, repeat: 'custom', multiDay: false, repeatConfig: { cyclicPattern: [{ active: 2, rest: 1 }] } }))
      .toBe('↻ Цикл 3 дней');
    expect(getRepeatLabel({ ...baseRpt, repeat: 'custom', multiDay: false, repeatConfig: { every: 2, unit: 'week' } }))
      .toBe('↻ Каждые 2 нед');
    expect(getRepeatLabel({ ...baseRpt, repeat: 'custom', multiDay: false, repeatConfig: { every: 1, unit: 'month', months: [1, 2, 3] } }))
      .toBe('↻ Каждые 1 мес, сезонно');
  });
});

describe('buildRepeatOptions', () => {
  const single = { multiDay: false, dayCount: 0, rangeIsMonthOrMore: false, rangeIsYearOrMore: false, ...baseRpt };

  it('single-режим — все опции присутствуют', () => {
    const opts = buildRepeatOptions(single);
    expect(opts.map(o => o.value)).toEqual(['daily', 'weekly', 'weekdays', 'monthly', 'yearly']);
    expect(opts.find(o => o.value === 'weekly')?.accent).toBe('в понедельник');
  });

  it('multiDay — убирает daily/weekdays', () => {
    const opts = buildRepeatOptions({ ...single, multiDay: true, dayCount: 3 });
    expect(opts.map(o => o.value)).toEqual(['weekly', 'monthly', 'yearly']);
    expect(opts.find(o => o.value === 'weekly')?.accent).toBe('с понедельника');
  });

  it('multiDay — убирает weekly при dayCount > 6', () => {
    const opts = buildRepeatOptions({ ...single, multiDay: true, dayCount: 7 });
    expect(opts.map(o => o.value)).toEqual(['monthly', 'yearly']);
  });

  it('multiDay — убирает monthly при диапазоне ≥ месяца', () => {
    const opts = buildRepeatOptions({ ...single, multiDay: true, dayCount: 3, rangeIsMonthOrMore: true });
    expect(opts.map(o => o.value)).toEqual(['weekly', 'yearly']);
  });

  it('multiDay — убирает yearly при диапазоне ≥ года', () => {
    const opts = buildRepeatOptions({ ...single, multiDay: true, dayCount: 3, rangeIsYearOrMore: true });
    expect(opts.map(o => o.value)).toEqual(['weekly', 'monthly']);
  });
});
