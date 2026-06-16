'use client';

import { useMemo, useState } from 'react';
import { toDateStr } from '../../../lib/tasks';
import { useHolidays, HolidayMap, HolidayEntry } from '../../../lib/holidays';
import { useAuthStore } from '../../../store/authStore';
import { fromStr, today0, buildGrid } from '../date-picker/logic';
import { MiniCalendarGrid } from '../date-picker/MiniCalendarGrid';

interface Props {
  value: string;
  onChange: (iso: string) => void;
}

/**
 * Одно-датный календарь для фильтров «Коробки». Переиспользует ту же сетку
 * (MiniCalendarGrid), что и в создании задачи — единый вид по всему приложению.
 */
export function BoxDateCalendar({ value, onChange }: Props) {
  const now  = today0();
  const seed = value ? fromStr(value) : now;

  const [calYear,   setCalYear]   = useState(seed.getFullYear());
  const [calMonth,  setCalMonth]  = useState(seed.getMonth());
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  const showHolidays = useAuthStore(s => s.user?.showHolidays !== false);
  const { data: holData } = useHolidays(calYear, showHolidays);
  const holidayMap = useMemo(() => {
    const m: HolidayMap = new Map<string, HolidayEntry>();
    for (const e of holData ?? []) m.set(e.date, e);
    return m;
  }, [holData]);

  const grid = buildGrid(calYear, calMonth);

  return (
    <MiniCalendarGrid
      calYear={calYear}
      calMonth={calMonth}
      setCalYear={setCalYear}
      setCalMonth={setCalMonth}
      now={now}
      grid={grid}
      holidayMap={holidayMap}
      multiDay={false}
      calTarget="start"
      date={value}
      selStr={value}
      endStr=""
      todayStr={toDateStr(now)}
      hoverDate={hoverDate}
      setHoverDate={setHoverDate}
      previewDate={null}
      onDayClick={(d) => onChange(toDateStr(d))}
    />
  );
}
