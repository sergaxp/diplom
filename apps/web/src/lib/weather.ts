import { useQuery } from '@tanstack/react-query';
import { toDateStr } from './tasks';

export interface DayWeather {
  date: string;
  tempMax: number;
  tempMin: number;
  weatherCode?: number;
  precipSum?: number;
}

export interface DetailedDayWeather {
  date: string;
  tempMax: number;
  tempMin: number;
  feelsLikeMax: number;
  weatherCode: number;
  precipSum: number;
  precipProbMax: number;
  windSpeedMax: number;
  uvIndex: number;
}

export interface CurrentWeather {
  temp: number;
  feelsLike: number;
  weatherCode: number;
  windSpeed: number;
  humidity: number;
}

// Координаты по умолчанию – Челябинск
const DEFAULT_LAT = 55.16;
const DEFAULT_LON = 61.40;
const DEFAULT_TZ  = 'Asia/Yekaterinburg';

// ── WMO коды погоды → описание и иконка ──────────────────────
export function weatherCodeToInfo(code: number): { label: string; icon: string } {
  if (code === 0)                 return { label: 'Ясно',                  icon: 'Sun'            };
  if (code === 1)                 return { label: 'Преим. ясно',           icon: 'Sun'            };
  if (code === 2)                 return { label: 'Переменная облачность', icon: 'CloudSun'       };
  if (code === 3)                 return { label: 'Пасмурно',              icon: 'Cloud'          };
  if (code === 45 || code === 48) return { label: 'Туман',                 icon: 'Cloud'          };
  if (code >= 51 && code <= 57)   return { label: 'Морось',                icon: 'CloudDrizzle'   };
  if (code >= 61 && code <= 67)   return { label: 'Дождь',                 icon: 'CloudRain'      };
  if (code >= 71 && code <= 77)   return { label: 'Снег',                  icon: 'CloudSnow'      };
  if (code >= 80 && code <= 82)   return { label: 'Ливень',                icon: 'CloudRain'      };
  if (code >= 85 && code <= 86)   return { label: 'Снегопад',              icon: 'CloudSnow'      };
  if (code === 95)                return { label: 'Гроза',                 icon: 'CloudLightning' };
  if (code >= 96)                 return { label: 'Гроза с градом',        icon: 'CloudLightning' };
  return { label: 'Облачно', icon: 'Cloud' };
}

// ── Геокодинг города ─────────────────────────────────────────
interface GeoResult { lat: number; lon: number; timezone: string }

async function geocodeCity(city: string): Promise<GeoResult | null> {
  const params = new URLSearchParams({ name: city, count: '1', language: 'ru', format: 'json' });
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
  if (!res.ok) return null;
  const json = await res.json();
  const r = json.results?.[0];
  if (!r) return null;
  return { lat: r.latitude, lon: r.longitude, timezone: r.timezone ?? DEFAULT_TZ };
}

// ── Обратный геокодинг (Nominatim) ───────────────────────────
export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  const params = new URLSearchParams({
    lat: String(lat), lon: String(lon), format: 'json', 'accept-language': 'ru',
  });
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${params}`,
    { headers: { 'User-Agent': 'warmingtea/1.0' } },
  );
  if (!res.ok) return null;
  const json = await res.json();
  const addr = json.address ?? {};
  return addr.city ?? addr.town ?? addr.municipality ?? addr.county ?? null;
}

// ── Погода за месяц (для календаря) ──────────────────────────
async function fetchWeatherForMonth(
  year: number, month: number, lat: number, lon: number, tz: string,
): Promise<Map<string, DayWeather>> {
  const today      = new Date(); today.setHours(0, 0, 0, 0);
  const monthStart = new Date(year, month, 1);
  const lastDay    = new Date(year, month + 1, 0).getDate();
  const monthEnd   = new Date(year, month, lastDay);

  const start = toDateStr(monthStart);
  const end   = toDateStr(monthEnd);

  // Месяц целиком слишком далеко в будущем — прогноза нет
  const daysToStart = Math.round((monthStart.getTime() - today.getTime()) / 86_400_000);
  if (daysToStart > 16) return new Map();

  const commonParams = {
    latitude: String(lat), longitude: String(lon),
    daily: 'temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum', timezone: tz,
  };

  const map = new Map<string, DayWeather>();

  const collect = (json: { daily?: Record<string, (number | null)[] | string[]> }) => {
    const daily = json?.daily;
    const times = daily?.time as string[] | undefined;
    if (!times) return;
    const tMax = daily!.temperature_2m_max as (number | null)[];
    const tMin = daily!.temperature_2m_min as (number | null)[];
    const wc   = daily!.weathercode as (number | null)[] | undefined;
    const pr   = daily!.precipitation_sum as (number | null)[] | undefined;
    times.forEach((date, i) => {
      const max = tMax?.[i];
      if (date >= start && date <= end && max != null) {
        map.set(date, {
          date,
          tempMax: Math.round(max),
          tempMin: Math.round(tMin[i] as number),
          weatherCode: wc?.[i] ?? undefined,
          precipSum: pr?.[i] != null ? Math.round((pr[i] as number) * 10) / 10 : undefined,
        });
      }
    });
  };

  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

  // 1) Историческая часть месяца — архивный API (ERA5).
  //    Forecast API отдаёт прошлое надёжно лишь ~3 недели назад (дальше — null),
  //    поэтому глубину истории всегда берём из архива.
  if (monthStart <= yesterday) {
    const archEnd = monthEnd <= yesterday ? end : toDateStr(yesterday);
    const url = 'https://archive-api.open-meteo.com/v1/archive?' + new URLSearchParams({
      ...commonParams, start_date: start, end_date: archEnd,
    });
    try {
      const res = await fetch(url);
      if (res.ok) collect(await res.json());
    } catch { /* частичные данные допустимы */ }
  }

  // 2) Сегодня + будущее (и небольшой запас прошлого, чтобы закрыть возможную
  //    задержку архива за последние дни) — forecast API.
  if (monthEnd >= today) {
    const pastDays     = monthStart < today ? 7 : 0;
    const forecastDays = Math.min(16, Math.max(1,
      Math.round((monthEnd.getTime() - today.getTime()) / 86_400_000) + 1));
    const url = 'https://api.open-meteo.com/v1/forecast?' + new URLSearchParams({
      ...commonParams, past_days: String(pastDays), forecast_days: String(forecastDays),
    });
    try {
      const res = await fetch(url);
      if (res.ok) collect(await res.json());
    } catch { /* частичные данные допустимы */ }
  }

  return map;
}

// ── Детальная погода на конкретный день ───────────────────────
async function fetchDayWeatherData(
  date: string, lat: number, lon: number, tz: string,
): Promise<DetailedDayWeather | null> {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(date + 'T00:00:00');
  const daysDiff = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  const daily = 'temperature_2m_max,temperature_2m_min,apparent_temperature_max,weathercode,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max';

  let url: string;
  if (daysDiff > 16) {
    // Слишком далеко в будущем – данных нет
    return null;
  } else if (daysDiff < -14) {
    // Forecast API надёжно отдаёт прошлое лишь ~3 недели назад — глубже берём архив (ERA5)
    url = 'https://archive-api.open-meteo.com/v1/archive?' + new URLSearchParams({
      latitude: String(lat), longitude: String(lon), timezone: tz,
      start_date: date, end_date: date, daily,
    });
  } else {
    const pastDays     = Math.max(0, -daysDiff);
    const forecastDays = Math.max(1, daysDiff + 1);
    url = 'https://api.open-meteo.com/v1/forecast?' + new URLSearchParams({
      latitude: String(lat), longitude: String(lon), timezone: tz,
      past_days: String(pastDays), forecast_days: String(forecastDays), daily,
    });
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather API ${res.status}`);
  const json = await res.json();

  const idx = (json.daily.time as string[]).indexOf(date);
  if (idx === -1) return null;

  return {
    date,
    tempMax:      Math.round(json.daily.temperature_2m_max[idx]),
    tempMin:      Math.round(json.daily.temperature_2m_min[idx]),
    feelsLikeMax: Math.round(json.daily.apparent_temperature_max[idx] ?? json.daily.temperature_2m_max[idx]),
    weatherCode:  json.daily.weathercode[idx] ?? 0,
    precipSum:    Math.round((json.daily.precipitation_sum[idx] ?? 0) * 10) / 10,
    precipProbMax: Math.round(json.daily.precipitation_probability_max[idx] ?? 0),
    windSpeedMax: Math.round(json.daily.wind_speed_10m_max[idx] ?? 0),
    uvIndex:      Math.round(json.daily.uv_index_max[idx] ?? 0),
  };
}

// ── Текущая погода ────────────────────────────────────────────
async function fetchCurrentWeatherData(
  lat: number, lon: number, tz: string,
): Promise<CurrentWeather | null> {
  const url = 'https://api.open-meteo.com/v1/forecast?' + new URLSearchParams({
    latitude: String(lat), longitude: String(lon), timezone: tz,
    current: 'temperature_2m,apparent_temperature,weathercode,wind_speed_10m,relative_humidity_2m',
  });

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather API ${res.status}`);
  const json = await res.json();
  if (!json.current) return null;

  return {
    temp:        Math.round(json.current.temperature_2m),
    feelsLike:   Math.round(json.current.apparent_temperature),
    weatherCode: json.current.weathercode ?? 0,
    windSpeed:   Math.round(json.current.wind_speed_10m ?? 0),
    humidity:    Math.round(json.current.relative_humidity_2m ?? 0),
  };
}

// ── Resolve location helper ───────────────────────────────────
export interface LocationData {
  lat?: number | null;
  lon?: number | null;
  name?: string | null;
}

async function resolveCoords(
  loc?: LocationData,
): Promise<{ lat: number; lon: number; tz: string }> {
  let lat = DEFAULT_LAT, lon = DEFAULT_LON, tz = DEFAULT_TZ;
  if (loc?.lat != null && loc?.lon != null) {
    lat = loc.lat; lon = loc.lon;
  } else if (loc?.name?.trim()) {
    try {
      const geo = await geocodeCity(loc.name.trim());
      if (geo) { lat = geo.lat; lon = geo.lon; tz = geo.timezone; }
    } catch { /* используем дефолтные */ }
  }
  return { lat, lon, tz };
}

// ── Хук: погода за месяц ─────────────────────────────────────
export function useMonthWeather(year: number, month: number, locationData?: LocationData) {
  const locKey = locationData?.lat != null
    ? `${locationData.lat},${locationData.lon}`
    : (locationData?.name ?? '');

  return useQuery({
    queryKey: ['weather', year, month, locKey],
    queryFn: async () => {
      const { lat, lon, tz } = await resolveCoords(locationData);
      return fetchWeatherForMonth(year, month, lat, lon, tz);
    },
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });
}

// ── Хук: детальная погода на день ────────────────────────────
export function useDayWeather(date: string, locationData?: LocationData) {
  const locKey = locationData?.lat != null
    ? `${locationData.lat},${locationData.lon}`
    : (locationData?.name ?? '');

  return useQuery({
    queryKey: ['weather', 'day', date, locKey],
    queryFn: async () => {
      const { lat, lon, tz } = await resolveCoords(locationData);
      return fetchDayWeatherData(date, lat, lon, tz);
    },
    staleTime: 1000 * 60 * 30,
    retry: 1,
    enabled: !!date,
  });
}

// ── Хук: текущая погода ───────────────────────────────────────
export function useCurrentWeather(locationData?: LocationData) {
  const locKey = locationData?.lat != null
    ? `${locationData.lat},${locationData.lon}`
    : (locationData?.name ?? '');

  return useQuery({
    queryKey: ['weather', 'current', locKey],
    queryFn: async () => {
      const { lat, lon, tz } = await resolveCoords(locationData);
      return fetchCurrentWeatherData(lat, lon, tz);
    },
    staleTime: 1000 * 60 * 10,
    retry: 1,
    refetchInterval: 1000 * 60 * 15,
  });
}
