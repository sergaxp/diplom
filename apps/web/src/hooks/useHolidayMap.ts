import { useMemo } from 'react';
import { useHolidays, HolidayMap } from '../lib/holidays';
import { useAuthStore } from '../store/authStore';

/** Карта праздников на текущий и следующий год (с учётом user.showHolidays) */
export function useHolidayMap(viewYear: number): HolidayMap {
  const { user } = useAuthStore();
  const showHolidays = user?.showHolidays !== false; // default true

  const { data: holCur  } = useHolidays(viewYear,     showHolidays);
  const { data: holNext } = useHolidays(viewYear + 1, showHolidays);

  return useMemo<HolidayMap>(() => {
    if (!showHolidays) return new Map();
    const m: HolidayMap = new Map();
    for (const e of [...(holCur ?? []), ...(holNext ?? [])]) m.set(e.date, e);
    return m;
  }, [showHolidays, holCur, holNext]);
}
