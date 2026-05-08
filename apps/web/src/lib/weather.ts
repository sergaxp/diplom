import { useQuery } from '@tanstack/react-query';
import { toDateStr } from './tasks';

export interface DayWeather {
  date: string;
  tempMax: number;
  tempMin: number;
}

// Координаты по умолчанию — Челябинск
const DEFAULT_LAT = 55.16;
const DEFAULT_LON = 61.40;
const DEFAULT_TZ  = 'Asia/Yekaterinburg';

// ── Геокодинг города через open-meteo ────────────────────────
interface GeoResult { lat: number; lon: number; timezone: string }

async function geocodeCity(city: string): Promise<GeoResult | null> {
  const params = new URLSearchParams({
    name:     city,
    count:    '1',
    language: 'ru',
    format:   'json',
  });
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
  if (!res.ok) return null;
  const json = await res.json();
  const r = json.results?.[0];
  if (!r) return null;
  return { lat: r.latitude, lon: r.longitude, timezone: r.timezone ?? DEFAULT_TZ };
}

// ── Получение названия города по координатам (Nominatim) ─────
export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  const params = new URLSearchParams({
    lat: String(lat), lon: String(lon),
    format: 'json', 'accept-language': 'ru',
  });
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${params}`,
    { headers: { 'User-Agent': 'warmingtea/1.0' } },
  );
  if (!res.ok) return null;
  const json = await res.json();
  const addr = json.address ?? {};
  // Приоритет: city → town → municipality → county (без «округ»/«район»)
  return addr.city ?? addr.town ?? addr.municipality ?? addr.county ?? null;
}

// ── Загрузка погоды за месяц ──────────────────────────────────
async function fetchWeatherForMonth(
  year: number,
  month: number,
  lat: number,
  lon: number,
  tz: string,
): Promise<Map<string, DayWeather>> {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const monthStart = new Date(year, month, 1);
  const lastDay    = new Date(year, month + 1, 0).getDate();
  const monthEnd   = new Date(year, month, lastDay);

  const start = toDateStr(monthStart);
  const end   = toDateStr(monthEnd);

  // Дней от начала месяца до сегодня (отрицательно если месяц в будущем)
  const daysSinceStart = Math.round((today.getTime() - monthStart.getTime()) / 86_400_000);
  // Дней от сегодня до конца месяца (отрицательно если месяц уже закончился)
  const daysToEnd      = Math.round((monthEnd.getTime()  - today.getTime())  / 86_400_000);

  const commonParams = {
    latitude:  String(lat),
    longitude: String(lon),
    daily:     'temperature_2m_max,temperature_2m_min',
    timezone:  tz,
  };

  let fetchUrl: string;

  if (daysSinceStart > 85) {
    // Старый месяц (> 85 дней назад): archive API
    fetchUrl = 'https://archive-api.open-meteo.com/v1/archive?' + new URLSearchParams({
      ...commonParams, start_date: start, end_date: end,
    });
  } else if (daysToEnd < 0) {
    // Месяц полностью в прошлом (в пределах 85 дней):
    // forecast API + past_days чтобы покрыть весь месяц
    const pastDays = Math.min(daysSinceStart + 5, 92);
    fetchUrl = 'https://api.open-meteo.com/v1/forecast?' + new URLSearchParams({
      ...commonParams, past_days: String(pastDays), forecast_days: '1',
    });
  } else if (daysSinceStart < -16) {
    // Месяц начинается более чем через 16 дней: данных нет
    return new Map();
  } else {
    // Текущий месяц или ближайшее будущее:
    // past_days + forecast_days — единственный способ получить и прошлое, и прогноз
    const pastDays     = Math.max(0, daysSinceStart);
    const forecastDays = Math.min(16, Math.max(1, daysToEnd + 1));
    fetchUrl = 'https://api.open-meteo.com/v1/forecast?' + new URLSearchParams({
      ...commonParams,
      past_days:     String(pastDays),
      forecast_days: String(forecastDays),
    });
  }

  const res = await fetch(fetchUrl);
  if (!res.ok) throw new Error(`Weather API ${res.status}`);
  const json = await res.json();

  const map = new Map<string, DayWeather>();
  (json.daily.time as string[]).forEach((date: string, i: number) => {
    // Фильтруем только дни текущего месяца
    if (date >= start && date <= end && json.daily.temperature_2m_max[i] != null) {
      map.set(date, {
        date,
        tempMax: Math.round(json.daily.temperature_2m_max[i]),
        tempMin: Math.round(json.daily.temperature_2m_min[i]),
      });
    }
  });
  return map;
}

export interface LocationData {
  lat?: number | null;
  lon?: number | null;
  name?: string | null;
}

// ── Хук: погода за месяц с учётом локации пользователя ───────
export function useMonthWeather(
  year: number,
  month: number,
  locationData?: LocationData,
) {
  const { lat: savedLat, lon: savedLon, name } = locationData ?? {};
  const key = savedLat != null ? `${savedLat},${savedLon}` : (name ?? '');

  return useQuery({
    queryKey: ['weather', year, month, key],
    queryFn: async () => {
      let lat = DEFAULT_LAT, lon = DEFAULT_LON, tz = DEFAULT_TZ;

      if (savedLat != null && savedLon != null) {
        // Координаты сохранены напрямую — геокодинг не нужен
        lat = savedLat;
        lon = savedLon;
      } else if (name?.trim()) {
        // Запасной вариант: геокодинг по имени
        try {
          const geo = await geocodeCity(name.trim());
          if (geo) { lat = geo.lat; lon = geo.lon; tz = geo.timezone; }
        } catch {
          // геокодинг не удался — используем Челябинск
        }
      }

      return fetchWeatherForMonth(year, month, lat, lon, tz);
    },
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });
}
