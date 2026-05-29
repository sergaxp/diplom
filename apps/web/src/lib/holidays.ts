import { useQuery } from '@tanstack/react-query';
import { api } from './api';

// ── Types ─────────────────────────────────────────────────────

export type HolidayType = 'holiday' | 'shortday' | 'workday';

export interface HolidayEntry {
  date: string;          // YYYY-MM-DD
  name: string;
  type: HolidayType;
}

export type HolidayMap = Map<string, HolidayEntry>;

// ── Встроенные федеральные праздники России (фиксированные даты) ──

const BUILTIN: Array<{ mm: string; dd: string; name: string }> = [
  { mm: '01', dd: '01', name: 'Новый год' },
  { mm: '01', dd: '02', name: 'Новогодние каникулы' },
  { mm: '01', dd: '03', name: 'Новогодние каникулы' },
  { mm: '01', dd: '04', name: 'Новогодние каникулы' },
  { mm: '01', dd: '05', name: 'Новогодние каникулы' },
  { mm: '01', dd: '06', name: 'Новогодние каникулы' },
  { mm: '01', dd: '07', name: 'Рождество Христово' },
  { mm: '01', dd: '08', name: 'Новогодние каникулы' },
  { mm: '01', dd: '09', name: 'Новогодние каникулы' },
  { mm: '02', dd: '23', name: 'День защитника Отечества' },
  { mm: '03', dd: '08', name: 'Международный женский день' },
  { mm: '05', dd: '01', name: 'Праздник Весны и Труда' },
  { mm: '05', dd: '09', name: 'День Победы' },
  { mm: '06', dd: '12', name: 'День России' },
  { mm: '11', dd: '04', name: 'День народного единства' },
];

function getBuiltinHolidays(year: number): HolidayEntry[] {
  return BUILTIN.map(({ mm, dd, name }) => ({
    date: `${year}-${mm}-${dd}`,
    name,
    type: 'holiday' as HolidayType,
  }));
}

/** Форматировать Date → YYYY-MM-DD без UTC-сдвига */
function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Добавляет переносы выходных для праздников, выпавших на выходной:
 *  - Воскресенье → следующий понедельник (+1 день)
 *  - Суббота     → следующий понедельник (+2 дня)
 *
 * По ТК РФ при совпадении праздника с выходным отдых переносится
 * на ближайший рабочий день (практически всегда на понедельник).
 * Если API уже добавил безымянный holiday на этот день – просто именуем его.
 * Если нет – создаём запись сами.
 */
function applyTransfers(year: number, map: Map<string, HolidayEntry>): void {
  for (const { mm, dd, name } of BUILTIN) {
    const d = new Date(year, parseInt(mm) - 1, parseInt(dd));
    const dow = d.getDay(); // 0=Вс, 6=Сб

    let offset = 0;
    if (dow === 0) offset = 1;       // Вс → пн
    else if (dow === 6) offset = 2;  // Сб → пн (пн = Сб+2)
    else continue;

    const transferDay = new Date(year, parseInt(mm) - 1, parseInt(dd) + offset);
    const transferDate = fmtDate(transferDay);

    // Не перезаписываем, если на этот день уже стоит другой именованный праздник
    const existing = map.get(transferDate);
    if (!existing) {
      map.set(transferDate, { date: transferDate, name: `${name} (перенос)`, type: 'holiday' });
    } else if (existing.type === 'holiday' && !existing.name) {
      // API подтвердил – добавляем имя
      map.set(transferDate, { ...existing, name: `${name} (перенос)` });
    } else if (existing.type === 'shortday') {
      // Перенос праздника имеет приоритет над сокращённым днём (May 11 и т.п.)
      map.set(transferDate, { date: transferDate, name: `${name} (перенос)`, type: 'holiday' });
    }
    // existing.name уже задано (другой именованный праздник) – не трогаем
  }
}

// ── localStorage cache ────────────────────────────────────────

const LS_KEY = (year: number) => `wt_holidays_${year}`;
const CACHE_TTL  = 30 * 24 * 60 * 60 * 1000;
/** Увеличить при изменении формата/логики кеша – инвалидирует старые записи */
const CACHE_VER  = 6;

function readCache(year: number): HolidayEntry[] | null {
  try {
    const raw = localStorage.getItem(LS_KEY(year));
    if (!raw) return null;
    const { data, savedAt, v }: { data: HolidayEntry[]; savedAt: number; v?: number } = JSON.parse(raw);
    if ((v ?? 0) < CACHE_VER) { localStorage.removeItem(LS_KEY(year)); return null; }
    if (Date.now() - savedAt > CACHE_TTL) { localStorage.removeItem(LS_KEY(year)); return null; }
    if (!Array.isArray(data) || data.length < BUILTIN.length) {
      localStorage.removeItem(LS_KEY(year));
      return null;
    }
    return data;
  } catch { return null; }
}

function writeCache(year: number, data: HolidayEntry[]) {
  try {
    localStorage.setItem(LS_KEY(year), JSON.stringify({ data, savedAt: Date.now(), v: CACHE_VER }));
  } catch { /* localStorage full */ }
}

// ── API fetch + merge with builtin + transfers ────────────────

async function fetchHolidays(year: number): Promise<HolidayEntry[]> {
  const cached = readCache(year);
  if (cached) return cached;

  // Базовые праздники – всегда без API
  const map = new Map<string, HolidayEntry>(
    getBuiltinHolidays(year).map(e => [e.date, e]),
  );

  try {
    const apiData: HolidayEntry[] = await api.get(`/holidays/${year}`).then(r => r.data);
    if (Array.isArray(apiData)) {
      for (const e of apiData) {
        // Рабочие субботы (workday) больше не показываем в календаре
        if (e.type === 'workday') continue;
        const existing = map.get(e.date);
        if (e.type === 'shortday') {
          // Не перезаписываем BUILTIN праздники (Jan 9 – Новогодние каникулы, и т.д.)
          if (!existing || existing.type !== 'holiday') {
            map.set(e.date, e);
          }
        } else if (e.type === 'holiday' && !existing) {
          // Дополнительный нерабочий день из API (мосты, нестандартные переносы)
          map.set(e.date, e);
        }
      }
    }
  } catch { /* API недоступен – работаем только на встроенных */ }

  // Применяем переносы Вс→Пн и Сб→Пн
  applyTransfers(year, map);

  const result = [...map.values()];
  writeCache(year, result);
  return result;
}

// ── TanStack Query hook ───────────────────────────────────────

/** xmlcalendar.ru публикует данные только для текущего и следующего года */
const MAX_YEAR_AHEAD = 1;

export function useHolidays(year: number, enabled = true) {
  const maxYear = new Date().getFullYear() + MAX_YEAR_AHEAD;
  return useQuery<HolidayEntry[]>({
    queryKey: ['holidays', year],
    queryFn:  () => fetchHolidays(year),
    staleTime: CACHE_TTL,
    retry: 1,
    enabled: enabled && year > 2000 && year <= maxYear,
  });
}

export function useHolidayMap(...years: number[]): HolidayMap {
  const queries = years.map(y => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { data } = useHolidays(y);
    return data ?? [];
  });
  const map: HolidayMap = new Map();
  for (const entries of queries) {
    for (const e of entries) map.set(e.date, e);
  }
  return map;
}

// ── Helpers ───────────────────────────────────────────────────

export function getHolidayColor(type: HolidayType): string {
  switch (type) {
    case 'holiday':  return '#ef4444';
    case 'shortday': return '#f59e0b';
    case 'workday':  return '#3b82f6';
  }
}

const HOLIDAY_NAMES: Record<string, string> = {
  '01-01': 'Новый год',
  '01-02': 'Новогодние каникулы',
  '01-03': 'Новогодние каникулы',
  '01-04': 'Новогодние каникулы',
  '01-05': 'Новогодние каникулы',
  '01-06': 'Новогодние каникулы',
  '01-07': 'Рождество Христово',
  '01-08': 'Новогодние каникулы',
  '01-09': 'Новогодние каникулы',
  '02-23': 'День защитника Отечества',
  '03-08': 'Международный женский день',
  '05-01': 'Праздник Весны и Труда',
  '05-09': 'День Победы',
  '06-12': 'День России',
  '11-04': 'День народного единства',
};

export function getHolidayName(date: string): string {
  return HOLIDAY_NAMES[date.slice(5)] ?? 'Праздничный день';
}
