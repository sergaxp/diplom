import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { toDateStr, checkWeatherCondition, type WeatherCondition } from './tasks';

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

// Одна точка почасового прогноза (для детального графика).
export interface HourlyPoint {
  time: string;            // ISO в локальном tz: '2026-06-16T14:00'
  hour: number;            // 0..23
  temp: number;
  feelsLike: number;
  precipProb: number | null; // в архиве (ERA5) недоступно → null
  precip: number;          // мм
  weatherCode: number;
  windSpeed: number;       // км/ч
  windGusts: number;
  windDir: number;         // градусы
  humidity: number;        // %
  pressure: number;        // гПа
  isDay: boolean;
}

// Детальный прогноз на один день: суточные «экстра» + почасовые точки.
export interface DayDetail {
  date: string;
  sunrise?: string;
  sunset?: string;
  daylightDuration?: number; // секунды
  uvIndexMax?: number;
  windGustsMax?: number;
  hours: HourlyPoint[];
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

// ── Детальный прогноз (суточные экстра + почасовые) ───────────
// Архив (ERA5) не отдаёт часть полей (вероятность осадков, UV) — поэтому
// набор полей для forecast и archive разный, иначе archive-API падает 400-кой.
const DETAIL_DAILY_FC = 'sunrise,sunset,daylight_duration,uv_index_max,wind_gusts_10m_max';
const DETAIL_DAILY_AR = 'sunrise,sunset,daylight_duration,wind_gusts_10m_max';
const DETAIL_HOURLY_FC = 'temperature_2m,apparent_temperature,precipitation,precipitation_probability,weathercode,wind_speed_10m,wind_gusts_10m,wind_direction_10m,relative_humidity_2m,surface_pressure,is_day';
const DETAIL_HOURLY_AR = 'temperature_2m,apparent_temperature,precipitation,weathercode,wind_speed_10m,wind_gusts_10m,wind_direction_10m,relative_humidity_2m,surface_pressure,is_day';

type Series = (number | null)[] | undefined;

// Чистая функция (тестируется без сети): из ответа open-meteo собирает DayDetail,
// оставляя только часы запрошенной даты. Фильтр по строке времени корректен по
// часовому поясу локации и переживает переход на летнее время (день 23/25 часов).
export function parseDayDetail(
  json: { daily?: Record<string, unknown[]>; hourly?: Record<string, unknown[]> } | null | undefined,
  date: string,
): DayDetail | null {
  const h = json?.hourly;
  const times = h?.time as string[] | undefined;
  if (!times) return null;

  const temp = h!.temperature_2m as Series;
  const feels = h!.apparent_temperature as Series;
  const pProb = h!.precipitation_probability as Series;
  const precip = h!.precipitation as Series;
  const wc = h!.weathercode as Series;
  const wind = h!.wind_speed_10m as Series;
  const gust = h!.wind_gusts_10m as Series;
  const wdir = h!.wind_direction_10m as Series;
  const hum = h!.relative_humidity_2m as Series;
  const pres = h!.surface_pressure as Series;
  const isDay = h!.is_day as Series;

  const r = (v: number | null | undefined, d = 0) => (v == null ? d : Math.round(v));

  const hours: HourlyPoint[] = [];
  times.forEach((t, i) => {
    if (!t.startsWith(date)) return;
    if (temp?.[i] == null) return; // незаполненный час (край прогноза)
    hours.push({
      time: t,
      hour: Number(t.slice(11, 13)),
      temp: r(temp[i]),
      feelsLike: r(feels?.[i] ?? temp[i]),
      precipProb: pProb?.[i] == null ? null : r(pProb[i]),
      precip: precip?.[i] == null ? 0 : Math.round((precip[i] as number) * 10) / 10,
      weatherCode: r(wc?.[i]),
      windSpeed: r(wind?.[i]),
      windGusts: r(gust?.[i]),
      windDir: r(wdir?.[i]),
      humidity: r(hum?.[i]),
      pressure: r(pres?.[i]),
      isDay: isDay ? isDay[i] === 1 : true,
    });
  });
  if (!hours.length) return null;

  const d = json?.daily;
  const dNum = (key: string): number | undefined => {
    const v = (d?.[key] as Series)?.[0];
    return v == null ? undefined : v;
  };
  const dStr = (key: string): string | undefined =>
    ((d?.[key] as (string | null)[] | undefined)?.[0] as string) ?? undefined;

  return {
    date,
    sunrise: dStr('sunrise'),
    sunset: dStr('sunset'),
    daylightDuration: dNum('daylight_duration'),
    uvIndexMax: dNum('uv_index_max'),
    windGustsMax: dNum('wind_gusts_10m_max'),
    hours,
  };
}

// ── «Лучшее время» дня ────────────────────────────────────────
export interface BestWindow {
  bestHour: number;   // рекомендуемый час (для кнопки «перенести»)
  startHour: number;  // границы непрерывного «хорошего» окна
  endHour: number;
  reason: string;
}

// Чистая функция (тестируется без сети). Если задано погодное условие задачи —
// рассматриваем только часы, проходящие его (skipRain и т.п. на уровне часа);
// иначе ранжируем относительно: ближе к комфортной «ощущается», суше, тише ветер,
// днём предпочтительнее. Возвращает null, если подходящих часов нет.
export function computeBestWindow(
  hours: HourlyPoint[],
  condition?: WeatherCondition | null,
): BestWindow | null {
  if (!hours.length) return null;

  const hasCond = !!condition && Object.values(condition).some(v => v != null && v !== false);
  const condOk = (h: HourlyPoint) =>
    !hasCond ||
    checkWeatherCondition({ tempMax: h.temp, tempMin: h.temp, weatherCode: h.weatherCode }, condition!).ok;

  const candidates = hours.filter(condOk);
  if (!candidates.length) return null;

  const score = (h: HourlyPoint) =>
    -Math.abs(h.feelsLike - 21)            // ближе к 21° — комфортнее
    - ((h.precipProb ?? 0) / 100) * 12     // дождь сильно штрафует
    - Math.max(0, h.windSpeed - 20) * 0.2  // сильный ветер чуть штрафует
    + (h.isDay ? 1.5 : 0);                 // светлое время предпочтительнее

  const best = candidates.reduce((a, b) => (score(b) > score(a) ? b : a));

  // Расширяем окно вокруг лучшего часа по подряд идущим «хорошим» часам.
  const good = (h: HourlyPoint) => condOk(h) && (h.precipProb == null || h.precipProb < 40);
  const bi = hours.findIndex(h => h.hour === best.hour);
  let s = bi, e = bi;
  while (s > 0 && good(hours[s - 1])) s--;
  while (e < hours.length - 1 && good(hours[e + 1])) e++;

  const reason = hasCond
    ? 'подходит под погодное условие задачи'
    : (best.precipProb != null && best.precipProb < 20 ? 'сухое и комфортное окно' : 'самое комфортное окно');

  return { bestHour: best.hour, startHour: hours[s].hour, endHour: hours[e].hour, reason };
}

async function fetchDayDetailData(
  date: string, lat: number, lon: number, tz: string,
): Promise<DayDetail | null> {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(date + 'T00:00:00');
  const daysDiff = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  if (daysDiff > 15) return null; // дальше горизонта прогноза

  // start/end = date: запрашиваем почасовые только на нужный день (а не 16×24).
  const useArchive = daysDiff < -14;
  const json = await apiGet(useArchive ? '/weather/archive' : '/weather/forecast', {
    lat, lon, tz,
    daily: useArchive ? DETAIL_DAILY_AR : DETAIL_DAILY_FC,
    hourly: useArchive ? DETAIL_HOURLY_AR : DETAIL_HOURLY_FC,
    start_date: date, end_date: date,
  });
  return parseDayDetail(json, date);
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

// ── Хук: детальный прогноз на день (ленивый) ─────────────────
// enabled управляет загрузкой — почасовые тянем только когда открыта модалка,
// а не для каждой карточки. staleTime синхронизирован с TTL бэкенда (15 мин).
export function useDayDetail(
  date: string,
  locationData?: LocationData,
  opts?: { enabled?: boolean },
) {
  const locKey = locationData?.lat != null
    ? `${locationData.lat},${locationData.lon}`
    : (locationData?.name ?? '');

  return useQuery({
    queryKey: ['weather', 'detail', date, locKey],
    queryFn: async () => {
      const { lat, lon, tz } = await resolveCoords(locationData);
      return fetchDayDetailData(date, lat, lon, tz);
    },
    staleTime: 1000 * 60 * 15,
    retry: 1,
    enabled: (opts?.enabled ?? true) && !!date,
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
