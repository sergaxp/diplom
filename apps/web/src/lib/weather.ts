import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';
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

// Кэш геокодинга города — иначе каждый запрос погоды (а их теперь
// несколько на месяц) повторно ходил в сеть за координатами.
const geocodeCache = new Map<string, GeoResult | null>();

async function geocodeCity(city: string): Promise<GeoResult | null> {
  const key = city.trim().toLowerCase();
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;
  const params = new URLSearchParams({ name: city, count: '1', language: 'ru', format: 'json' });
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
  if (!res.ok) return null;
  const json = await res.json();
  const r = json.results?.[0];
  const result = r ? { lat: r.latitude, lon: r.longitude, timezone: r.timezone ?? DEFAULT_TZ } : null;
  geocodeCache.set(key, result);
  return result;
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
// Источник делится на два независимых запроса (forecast и archive),
// чтобы быстрый forecast показывал ближние дни сразу, не дожидаясь
// медленного архивного API (ERA5).

const MONTH_DAILY = 'temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum';

function monthBounds(year: number, month: number) {
  const today      = new Date(); today.setHours(0, 0, 0, 0);
  const monthStart = new Date(year, month, 1);
  const lastDay    = new Date(year, month + 1, 0).getDate();
  const monthEnd   = new Date(year, month, lastDay);
  return {
    today, monthStart, monthEnd,
    start: toDateStr(monthStart), end: toDateStr(monthEnd),
  };
}

function collectMonth(
  json: { daily?: Record<string, (number | null)[] | string[]> },
  start: string, end: string, map: Map<string, DayWeather>,
) {
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
}

// Погода идёт через наш бэкенд (/weather/*): он ходит в open-meteo быстро
// и кэширует. Браузеры пользователей (особенно из РФ) ходят туда медленно.
type WeatherParams = Record<string, string | number | undefined>;

async function apiGet(path: string, params: WeatherParams) {
  return api.get(path, { params }).then((r) => r.data);
}

// Для частичных данных (месяц): ошибка одного источника не валит всё.
async function apiGetSafe(path: string, params: WeatherParams) {
  try { return await apiGet(path, params); } catch { return null; }
}

// Быстрая часть: сегодня + будущее (+ небольшой запас прошлого).
async function fetchMonthForecast(
  year: number, month: number, lat: number, lon: number, tz: string,
): Promise<Map<string, DayWeather>> {
  const { today, monthStart, monthEnd } = monthBounds(year, month);
  const map = new Map<string, DayWeather>();
  // Прогноз покрывает только настоящее/будущее; целиком прошлый месяц — пропускаем
  if (monthEnd < today) return map;
  if (Math.round((monthStart.getTime() - today.getTime()) / 86_400_000) > 16) return map;

  const pastDays     = monthStart < today ? 7 : 0;
  // Всегда берём полный горизонт прогноза (16 дней) — он покрывает и конец
  // текущего месяца, и начало следующего (для границы в ленте), одним запросом.
  const forecastDays = 16;
  const json = await apiGetSafe('/weather/forecast', {
    lat, lon, tz, daily: MONTH_DAILY, past_days: pastDays, forecast_days: forecastDays,
  });
  // Без клипа по месяцу: собираем все дни прогноза (в т.ч. начало следующего
  // месяца) — чтобы лента на границе месяца показывала погоду без доп. запросов.
  if (json) collectMonth(json, '0000-00-00', '9999-99-99', map);
  return map;
}

// Медленная часть: историческая глубина месяца (ERA5).
async function fetchMonthArchive(
  year: number, month: number, lat: number, lon: number, tz: string,
): Promise<Map<string, DayWeather>> {
  const { today, monthStart, monthEnd, start, end } = monthBounds(year, month);
  const map = new Map<string, DayWeather>();
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  if (monthStart > yesterday) return map; // у месяца нет прошлой части

  const archEnd = monthEnd <= yesterday ? end : toDateStr(yesterday);
  const json = await apiGetSafe('/weather/archive', {
    lat, lon, tz, daily: MONTH_DAILY, start_date: start, end_date: archEnd,
  });
  if (json) collectMonth(json, start, end, map);
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

  let json;
  if (daysDiff > 15) {
    // forecast_days максимум 16 (сегодня…сегодня+15), дальше прогноза нет
    return null;
  } else if (daysDiff < -14) {
    // Forecast API надёжно отдаёт прошлое лишь ~3 недели назад — глубже берём архив (ERA5)
    json = await apiGet('/weather/archive', { lat, lon, tz, daily, start_date: date, end_date: date });
  } else {
    const pastDays     = Math.max(0, -daysDiff);
    const forecastDays = Math.min(16, Math.max(1, daysDiff + 1));
    json = await apiGet('/weather/forecast', { lat, lon, tz, daily, past_days: pastDays, forecast_days: forecastDays });
  }

  const idx = (json.daily.time as string[]).indexOf(date);
  if (idx === -1) return null;
  // Последний день прогноза модель может ещё не рассчитать → temp = null.
  // Возвращаем null, чтобы не показывать «0/0 ясно».
  if (json.daily.temperature_2m_max[idx] == null) return null;

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
  const json = await apiGet('/weather/forecast', {
    lat, lon, tz,
    current: 'temperature_2m,apparent_temperature,weathercode,wind_speed_10m,relative_humidity_2m',
  });
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
// Два независимых запроса: forecast (быстрый, ближние дни) и archive
// (медленный, история). Карта собирается из обоих и обновляется по мере
// готовности каждого — поэтому ближние дни показывают температуру сразу,
// а не ждут медленный архив (раньше всё ждало Promise.all и держало t°).
export function useMonthWeather(year: number, month: number, locationData?: LocationData) {
  const locKey = locationData?.lat != null
    ? `${locationData.lat},${locationData.lon}`
    : (locationData?.name ?? '');

  const forecastQ = useQuery({
    queryKey: ['weather', 'month-fc', year, month, locKey],
    queryFn: async () => {
      const { lat, lon, tz } = await resolveCoords(locationData);
      return fetchMonthForecast(year, month, lat, lon, tz);
    },
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });

  const archiveQ = useQuery({
    queryKey: ['weather', 'month-arch', year, month, locKey],
    queryFn: async () => {
      const { lat, lon, tz } = await resolveCoords(locationData);
      return fetchMonthArchive(year, month, lat, lon, tz);
    },
    staleTime: 1000 * 60 * 60 * 6,
    retry: 1,
  });

  const data = useMemo(() => {
    const m = new Map<string, DayWeather>();
    archiveQ.data?.forEach((v, k) => m.set(k, v));
    forecastQ.data?.forEach((v, k) => m.set(k, v)); // forecast приоритетнее для ближних дней
    return m;
  }, [archiveQ.data, forecastQ.data]);

  return {
    data,
    isLoading: forecastQ.isLoading || archiveQ.isLoading,
    isError: forecastQ.isError && archiveQ.isError,
  };
}

// ── Хук: погода для календаря (один месяц) ───────────────────
// Раньше грузил 3 месяца (×2 источника = до 6 запросов) — на мобильной сети
// это вставало в очередь и отваливалось по таймауту. Теперь только текущий
// месяц (2 запроса), а прогноз собирается на все 16 дней вперёд (включая
// начало следующего месяца), поэтому граница месяца в ленте всё равно покрыта.
export function useCalendarWeather(year: number, month: number, locationData?: LocationData) {
  return useMonthWeather(year, month, locationData);
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
