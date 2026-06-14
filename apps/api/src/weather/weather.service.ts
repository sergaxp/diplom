import {
  Injectable,
  BadRequestException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { buildMockWeather } from './weather.mock';

type Query = Record<string, string | undefined>;
interface CacheEntry {
  data: unknown;
  exp: number;
}

/**
 * Прокси к open-meteo с кэшем в памяти. Браузеры пользователей (особенно из РФ)
 * ходят в open-meteo медленно/нестабильно; сервер же отвечает за ~0.3с, плюс
 * кэш убирает повторные обращения.
 */
@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private static readonly MAX_ENTRIES = 1000;

  private static readonly FORECAST_TTL = 15 * 60 * 1000; // 15 мин
  private static readonly ARCHIVE_TTL = 6 * 60 * 60 * 1000; // 6 ч (история стабильна)

  // Бэкенд под JwtAuthGuard, но эндпоинт всё равно проксирует поля «как есть».
  // Whitelist не даёт авторизованному юзеру гонять через нас произвольные/тяжёлые
  // запросы к open-meteo и отсекает опечатки (которые archive-API роняет 400-кой).
  private static readonly ALLOWED_FIELDS = new Set([
    // daily
    'temperature_2m_max',
    'temperature_2m_min',
    'apparent_temperature_max',
    'apparent_temperature_min',
    'weathercode',
    'weather_code',
    'precipitation_sum',
    'precipitation_hours',
    'precipitation_probability_max',
    'wind_speed_10m_max',
    'wind_gusts_10m_max',
    'uv_index_max',
    'sunrise',
    'sunset',
    'daylight_duration',
    // hourly
    'temperature_2m',
    'apparent_temperature',
    'precipitation',
    'precipitation_probability',
    'wind_speed_10m',
    'wind_gusts_10m',
    'wind_direction_10m',
    'relative_humidity_2m',
    'surface_pressure',
    'cloud_cover',
    'is_day',
    'uv_index',
  ]);

  private static readonly ARCHIVE_MAX_SPAN_DAYS = 92;

  // Dev-режим: отдаём синтетику вместо open-meteo (когда сервер не может до него
  // достучаться — напр. сети из РФ). Включается флагом WEATHER_MOCK=1. В проде off.
  // Геттер (а не static-поле): читаем env в рантайме, иначе значение зафиксируется
  // на момент импорта — раньше, чем ConfigModule подгрузит .env.
  private static get MOCK(): boolean {
    return (
      process.env.WEATHER_MOCK === '1' || process.env.WEATHER_MOCK === 'true'
    );
  }

  constructor() {
    if (WeatherService.MOCK)
      this.logger.warn(
        'WEATHER_MOCK включён — отдаю синтетическую погоду, open-meteo не вызывается',
      );
  }

  forecast(q: Query): Promise<unknown> {
    if (WeatherService.MOCK) return Promise.resolve(buildMockWeather(q));
    return this.proxy(
      'https://api.open-meteo.com/v1/forecast',
      this.forecastParams(q),
      WeatherService.FORECAST_TTL,
    );
  }

  archive(q: Query): Promise<unknown> {
    if (WeatherService.MOCK) return Promise.resolve(buildMockWeather(q));
    return this.proxy(
      'https://archive-api.open-meteo.com/v1/archive',
      this.archiveParams(q),
      WeatherService.ARCHIVE_TTL,
    );
  }

  private coord(v?: string): string {
    const n = Number(v);
    if (!Number.isFinite(n))
      throw new BadRequestException('Некорректные координаты');
    // Округляем до 2 знаков (~1 км — для погоды незаметно): резко повышает
    // попадание в кэш (соседние координаты схлопываются) и чуть приватнее.
    return String(Math.round(n * 100) / 100);
  }

  // Оставляем только разрешённые поля; пустой результат → не шлём параметр.
  private fields(csv?: string): string | undefined {
    if (!csv) return undefined;
    const kept = csv
      .split(',')
      .map((s) => s.trim())
      .filter((s) => WeatherService.ALLOWED_FIELDS.has(s));
    return kept.length ? kept.join(',') : undefined;
  }

  private dateStr(v?: string): string | undefined {
    return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
  }

  private clampInt(
    v: string | undefined,
    min: number,
    max: number,
    def: number,
  ): string {
    const n = parseInt(v ?? '', 10);
    return String(Math.min(max, Math.max(min, Number.isFinite(n) ? n : def)));
  }

  private forecastParams(q: Query): URLSearchParams {
    const p = new URLSearchParams();
    p.set('latitude', this.coord(q.lat));
    p.set('longitude', this.coord(q.lon));
    if (q.tz) p.set('timezone', q.tz);
    if (q.past_days != null)
      p.set('past_days', this.clampInt(q.past_days, 0, 92, 0));
    if (q.forecast_days != null)
      p.set('forecast_days', this.clampInt(q.forecast_days, 1, 16, 1));
    // start/end сужают окно до конкретного дня → не качаем hourly на все 16 дней.
    const start = this.dateStr(q.start_date);
    const end = this.dateStr(q.end_date);
    if (start) p.set('start_date', start);
    if (end) p.set('end_date', end);
    const daily = this.fields(q.daily);
    const hourly = this.fields(q.hourly);
    const current = this.fields(q.current);
    if (daily) p.set('daily', daily);
    if (hourly) p.set('hourly', hourly);
    if (current) p.set('current', current);
    return p;
  }

  private archiveParams(q: Query): URLSearchParams {
    const p = new URLSearchParams();
    p.set('latitude', this.coord(q.lat));
    p.set('longitude', this.coord(q.lon));
    if (q.tz) p.set('timezone', q.tz);
    const start = this.dateStr(q.start_date);
    let end = this.dateStr(q.end_date);
    // Ограничиваем размах архива, чтобы нельзя было запросить годы данных.
    if (start && end) {
      const span = (Date.parse(end) - Date.parse(start)) / 86_400_000;
      if (span > WeatherService.ARCHIVE_MAX_SPAN_DAYS) {
        end = new Date(
          Date.parse(start) + WeatherService.ARCHIVE_MAX_SPAN_DAYS * 86_400_000,
        )
          .toISOString()
          .slice(0, 10);
      }
    }
    if (start) p.set('start_date', start);
    if (end) p.set('end_date', end);
    const daily = this.fields(q.daily);
    const hourly = this.fields(q.hourly);
    if (daily) p.set('daily', daily);
    if (hourly) p.set('hourly', hourly);
    return p;
  }

  private async proxy(
    base: string,
    params: URLSearchParams,
    ttl: number,
  ): Promise<unknown> {
    const url = `${base}?${params.toString()}`;
    const hit = this.cache.get(url);
    if (hit && hit.exp > Date.now()) {
      // LRU: переставляем «свежий» хит в конец, чтобы при переполнении
      // вытеснялись действительно давно не используемые записи, а не просто
      // самые старые по вставке (важно при навигации по дням в деталке).
      this.cache.delete(url);
      this.cache.set(url, hit);
      return hit.data;
    }

    let data: unknown;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch (err) {
      this.logger.warn(`open-meteo failed: ${(err as Error).message}`);
      if (hit) return hit.data; // отдаём протухший кеш, если он есть
      throw new ServiceUnavailableException('Не удалось получить погоду');
    }

    this.cache.set(url, { data, exp: Date.now() + ttl });
    if (this.cache.size > WeatherService.MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value as string | undefined;
      if (oldest) this.cache.delete(oldest);
    }
    return data;
  }
}
