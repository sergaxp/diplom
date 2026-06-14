/**
 * Синтетический генератор погоды для локальной разработки (флаг WEATHER_MOCK=1).
 * Нужен там, где сервер не может достучаться до open-meteo (напр. сети из РФ).
 * Отдаёт данные в том же формате, что и open-meteo, поэтому весь фронтенд
 * (календарь, карточка, деталка, почасовой график) работает без интернета.
 * В проде по умолчанию выключено и не задействуется.
 */

type Query = Record<string, string | undefined>;

// Средние дневные максимумы по месяцам (умеренный климат) — для правдоподобия.
const MONTHLY_HIGH = [-9, -7, 0, 10, 18, 23, 25, 22, 16, 7, -2, -7];

// Детерминированный «шум» [lo, hi) по сид-числу — стабилен между запросами.
function noise(seed: number, lo: number, hi: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return lo + (x - Math.floor(x)) * (hi - lo);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function clampInt(
  v: string | undefined,
  min: number,
  max: number,
  def: number,
): number {
  const n = parseInt(v ?? '', 10);
  return Math.min(max, Math.max(min, Number.isFinite(n) ? n : def));
}

function listDates(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  const d = new Date(from);
  while (d <= to && out.length < 200) {
    out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function resolveDates(q: Query): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (q.start_date && q.end_date) {
    return listDates(
      new Date(q.start_date + 'T00:00:00'),
      new Date(q.end_date + 'T00:00:00'),
    );
  }
  const past = clampInt(q.past_days, 0, 92, 0);
  const fc = clampInt(q.forecast_days, 1, 16, 1);
  const from = new Date(today);
  from.setDate(from.getDate() - past);
  const to = new Date(today);
  to.setDate(to.getDate() + fc - 1);
  return listDates(from, to);
}

// Профиль дня: устойчивый сид по дате → max/min/дождливость.
function dayProfile(d: Date) {
  const seed = d.getFullYear() * 1000 + (d.getMonth() + 1) * 50 + d.getDate();
  const high = MONTHLY_HIGH[d.getMonth()] + noise(seed, -3, 3);
  const max = Math.round(high);
  const min = Math.round(high - 7 - noise(seed + 1, 0, 4));
  const rainRoll = noise(seed + 2, 0, 1);
  const rainy = rainRoll > 0.6; // ~40% дней с дождём
  return { max, min, rainy, seed };
}

function dayCode(p: ReturnType<typeof dayProfile>): number {
  if (p.rainy) return p.seed % 7 === 0 ? 95 : 61; // изредка гроза
  const r = noise(p.seed + 3, 0, 1);
  return r > 0.66 ? 0 : r > 0.33 ? 2 : 3;
}

function tempAt(p: ReturnType<typeof dayProfile>, h: number): number {
  const mid = (p.max + p.min) / 2;
  const half = (p.max - p.min) / 2;
  return mid + half * Math.cos(((h - 15) * Math.PI) / 12); // пик в 15:00, минимум в 3:00
}

function precipProbAt(p: ReturnType<typeof dayProfile>, h: number): number {
  const base = p.rainy ? (h >= 14 && h <= 20 ? 60 : 25) : 8;
  return Math.max(
    0,
    Math.min(100, Math.round(base + noise(p.seed + h, -10, 10))),
  );
}

// ── Daily ─────────────────────────────────────────────────────
function buildDaily(
  dates: Date[],
  fieldsCsv: string,
): Record<string, (number | string)[]> {
  const fields = fieldsCsv.split(',');
  const out: Record<string, (number | string)[]> = { time: dates.map(dateStr) };
  for (const f of fields) out[f] = [];

  dates.forEach((d) => {
    const p = dayProfile(d);
    const code = dayCode(p);
    const wind = Math.round(10 + noise(p.seed + 4, 0, 14));
    const ds = dateStr(d);
    const val: Record<string, number | string> = {
      temperature_2m_max: p.max,
      temperature_2m_min: p.min,
      apparent_temperature_max: p.max - 1,
      apparent_temperature_min: p.min - 2,
      weathercode: code,
      weather_code: code,
      precipitation_sum: p.rainy
        ? Math.round(noise(p.seed + 5, 1, 8) * 10) / 10
        : 0,
      precipitation_hours: p.rainy ? Math.round(noise(p.seed + 6, 2, 8)) : 0,
      precipitation_probability_max: p.rainy
        ? Math.round(60 + noise(p.seed + 7, 0, 30))
        : Math.round(noise(p.seed + 7, 0, 25)),
      wind_speed_10m_max: wind,
      wind_gusts_10m_max: wind + Math.round(8 + noise(p.seed + 8, 0, 8)),
      uv_index_max: Math.max(0, Math.round(3 + noise(p.seed + 9, 0, 5))),
      sunrise: `${ds}T${pad(5 + (d.getMonth() < 3 || d.getMonth() > 8 ? 3 : 0))}:30`,
      sunset: `${ds}T${pad(21 - (d.getMonth() < 3 || d.getMonth() > 8 ? 3 : 0))}:15`,
      daylight_duration: 57600,
    };
    for (const f of fields) out[f].push(val[f] ?? 0);
  });
  return out;
}

// ── Hourly ────────────────────────────────────────────────────
function buildHourly(
  dates: Date[],
  fieldsCsv: string,
): Record<string, (number | string)[]> {
  const fields = fieldsCsv.split(',');
  const out: Record<string, (number | string)[]> = { time: [] };
  for (const f of fields) out[f] = [];

  dates.forEach((d) => {
    const p = dayProfile(d);
    const ds = dateStr(d);
    for (let h = 0; h < 24; h++) {
      (out.time as string[]).push(`${ds}T${pad(h)}:00`);
      const temp = tempAt(p, h);
      const prob = precipProbAt(p, h);
      const wind = 6 + noise(p.seed + 100 + h, 0, 12);
      const isDay = h >= 6 && h < 21 ? 1 : 0;
      const code = prob > 55 ? 61 : prob > 30 ? 3 : isDay ? 1 : 2;
      const val: Record<string, number> = {
        temperature_2m: Math.round(temp * 10) / 10,
        apparent_temperature: Math.round((temp - 1 - wind * 0.1) * 10) / 10,
        precipitation:
          prob > 50 ? Math.round(noise(p.seed + h, 0, 2) * 10) / 10 : 0,
        precipitation_probability: prob,
        weathercode: code,
        weather_code: code,
        wind_speed_10m: Math.round(wind),
        wind_gusts_10m: Math.round(wind + 6),
        wind_direction_10m: Math.round(180 + noise(p.seed + 200 + h, -90, 90)),
        relative_humidity_2m: Math.round(
          Math.max(
            25,
            Math.min(
              98,
              60 + (isDay ? -10 : 15) + noise(p.seed + 300 + h, -8, 8),
            ),
          ),
        ),
        surface_pressure: Math.round(1012 + noise(p.seed + 400 + h, -8, 8)),
        cloud_cover: Math.round(
          Math.min(100, prob + noise(p.seed + 500 + h, 0, 40)),
        ),
        is_day: isDay,
        uv_index: isDay
          ? Math.max(
              0,
              Math.round((temp > 0 ? 4 : 1) + noise(p.seed + 600 + h, 0, 3)),
            )
          : 0,
      };
      for (const f of fields) (out[f] as number[]).push(val[f] ?? 0);
    }
  });
  return out;
}

// ── Current ───────────────────────────────────────────────────
function buildCurrent(fieldsCsv: string): Record<string, number | string> {
  const now = new Date();
  const p = dayProfile(now);
  const temp = tempAt(p, now.getHours());
  const wind = Math.round(8 + noise(p.seed + 700, 0, 10));
  const code = dayCode(p);
  const all: Record<string, number | string> = {
    time: `${dateStr(now)}T${pad(now.getHours())}:00`,
    temperature_2m: Math.round(temp),
    apparent_temperature: Math.round(temp - 1 - wind * 0.1),
    weathercode: code,
    weather_code: code,
    wind_speed_10m: wind,
    relative_humidity_2m: Math.round(60 + noise(p.seed + 800, -10, 10)),
  };
  const out: Record<string, number | string> = {};
  for (const f of fieldsCsv.split(',')) out[f] = all[f] ?? 0;
  if (!('time' in out)) out.time = all.time;
  return out;
}

export function buildMockWeather(q: Query): unknown {
  const dates = resolveDates(q);
  const res: Record<string, unknown> = {
    latitude: Number(q.lat) || 55.16,
    longitude: Number(q.lon) || 61.4,
    timezone: q.tz || 'Asia/Yekaterinburg',
  };
  if (q.daily) res.daily = buildDaily(dates, q.daily);
  if (q.hourly) res.hourly = buildHourly(dates, q.hourly);
  if (q.current) res.current = buildCurrent(q.current);
  return res;
}
