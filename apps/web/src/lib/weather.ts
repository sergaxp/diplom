import { useQuery } from '@tanstack/react-query';
import { toDateStr } from './tasks';

export interface DayWeather {
  date: string;
  tempMax: number;
  tempMin: number;
}

const LAT = 55.16;
const LON = 61.40;
const TZ  = 'Asia/Yekaterinburg';

async function fetchWeatherForMonth(
  year: number,
  month: number,
): Promise<Map<string, DayWeather>> {
  const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(year, month, 1);
  const daysAgo = (today.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24);

  // archive API for data older than ~85 days (forecast API covers ~3 months back)
  const useArchive = daysAgo > 85;
  const base = useArchive
    ? 'https://archive-api.open-meteo.com/v1/archive'
    : 'https://api.open-meteo.com/v1/forecast';

  // forecast API supports max 16 days ahead — clamp end_date
  let clampedEnd = end;
  if (!useArchive) {
    const maxForecast = new Date(today);
    maxForecast.setDate(maxForecast.getDate() + 15);
    const maxEnd = toDateStr(maxForecast);
    if (end > maxEnd) clampedEnd = maxEnd;
  }

  // nothing to fetch if start is beyond forecast window
  if (clampedEnd < start) return new Map();

  const params = new URLSearchParams({
    latitude:  String(LAT),
    longitude: String(LON),
    daily:     'temperature_2m_max,temperature_2m_min',
    start_date: start,
    end_date:   clampedEnd,
    timezone:   TZ,
  });

  const res = await fetch(`${base}?${params}`);
  if (!res.ok) throw new Error(`Weather API error: ${res.status}`);
  const json = await res.json();

  const map = new Map<string, DayWeather>();
  const times: string[]  = json.daily.time;
  const maxes: number[]  = json.daily.temperature_2m_max;
  const mines: number[]  = json.daily.temperature_2m_min;

  times.forEach((date, i) => {
    if (maxes[i] != null) {
      map.set(date, {
        date,
        tempMax: Math.round(maxes[i]),
        tempMin: Math.round(mines[i]),
      });
    }
  });

  return map;
}

export function useMonthWeather(year: number, month: number) {
  return useQuery({
    queryKey: ['weather', year, month],
    queryFn:  () => fetchWeatherForMonth(year, month),
    staleTime: 1000 * 60 * 60,     // 1 hour
    retry: 1,
  });
}
