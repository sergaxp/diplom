import { Injectable, BadRequestException, ServiceUnavailableException, Logger } from '@nestjs/common';

type Query = Record<string, string | undefined>;
interface CacheEntry { data: unknown; exp: number; }

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

  private static readonly FORECAST_TTL = 15 * 60 * 1000;      // 15 мин
  private static readonly ARCHIVE_TTL  = 6 * 60 * 60 * 1000;  // 6 ч (история стабильна)

  forecast(q: Query): Promise<unknown> {
    return this.proxy('https://api.open-meteo.com/v1/forecast', this.forecastParams(q), WeatherService.FORECAST_TTL);
  }

  archive(q: Query): Promise<unknown> {
    return this.proxy('https://archive-api.open-meteo.com/v1/archive', this.archiveParams(q), WeatherService.ARCHIVE_TTL);
  }

  private coord(v?: string): string {
    const n = Number(v);
    if (!Number.isFinite(n)) throw new BadRequestException('Некорректные координаты');
    return String(n);
  }

  private clampInt(v: string | undefined, min: number, max: number, def: number): string {
    const n = parseInt(v ?? '', 10);
    return String(Math.min(max, Math.max(min, Number.isFinite(n) ? n : def)));
  }

  private forecastParams(q: Query): URLSearchParams {
    const p = new URLSearchParams();
    p.set('latitude', this.coord(q.lat));
    p.set('longitude', this.coord(q.lon));
    if (q.tz) p.set('timezone', q.tz);
    if (q.past_days != null)     p.set('past_days', this.clampInt(q.past_days, 0, 92, 0));
    if (q.forecast_days != null) p.set('forecast_days', this.clampInt(q.forecast_days, 1, 16, 1));
    if (q.daily)   p.set('daily', q.daily);
    if (q.current) p.set('current', q.current);
    return p;
  }

  private archiveParams(q: Query): URLSearchParams {
    const p = new URLSearchParams();
    p.set('latitude', this.coord(q.lat));
    p.set('longitude', this.coord(q.lon));
    if (q.tz) p.set('timezone', q.tz);
    if (q.start_date) p.set('start_date', q.start_date);
    if (q.end_date)   p.set('end_date', q.end_date);
    if (q.daily)      p.set('daily', q.daily);
    return p;
  }

  private async proxy(base: string, params: URLSearchParams, ttl: number): Promise<unknown> {
    const url = `${base}?${params.toString()}`;
    const hit = this.cache.get(url);
    if (hit && hit.exp > Date.now()) return hit.data;

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
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    return data;
  }
}
