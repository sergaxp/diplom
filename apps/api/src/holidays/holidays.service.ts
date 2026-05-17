import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HolidayCache, HolidayEntry } from './entities/holiday-cache.entity';

// ── Реальный формат xmlcalendar.ru ────────────────────────────
// {
//   "year": 2026,
//   "months": [{ "month": 1, "days": "1,2,3,4,5,6,7,8,9+,10,11,17,18,24,25,31" }, ...],
//   "transitions": [{ "from": "DD.MM", "to": "DD.MM" }, ...],
//   "statistic": { ... }
// }
//
// days-строка: числа = нерабочие дни, число+ = сокращённый предпраздничный.
// transitions.from = рабочая суббота (перенос).

@Injectable()
export class HolidaysService {
  private readonly logger = new Logger(HolidaysService.name);

  constructor(
    @InjectRepository(HolidayCache)
    private readonly repo: Repository<HolidayCache>,
  ) {}

  async getByYear(year: number): Promise<HolidayEntry[]> {
    const cached = await this.repo.findOne({ where: { year } });
    if (cached) return cached.entries;

    const entries = await this.fetchAndParse(year);
    try {
      await this.repo.save({ year, entries });
    } catch { /* race condition — не страшно */ }
    return entries;
  }

  async refreshYear(year: number): Promise<HolidayEntry[]> {
    const entries = await this.fetchAndParse(year);
    await this.repo.upsert({ year, entries }, ['year']);
    return entries;
  }

  private async fetchAndParse(year: number): Promise<HolidayEntry[]> {
    const url = `https://xmlcalendar.ru/data/ru/${year}/calendar.json`;
    this.logger.log(`Fetching: ${url}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let raw: any;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.status === 404) {
        // Данные ещё не опубликованы (будущий год) — это норма, не ошибка
        this.logger.debug(`No calendar data for ${year} (404 — year not published yet)`);
        return [];
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      raw = await res.json();
    } catch (err) {
      this.logger.warn(`Fetch failed for ${year}: ${err}`);
      return [];
    }

    try {
      return this.parse(raw, year);
    } catch (err) {
      this.logger.error(`Parse failed for ${year}: ${err}. Keys: ${Object.keys(raw ?? {}).join(', ')}`);
      return [];
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parse(raw: any, year: number): HolidayEntry[] {
    const entries: HolidayEntry[] = [];

    // ── Рабочие субботы из transitions ────────────────────────
    // transitions[].from = "DD.MM" — этот день является рабочим (перенос)
    const workdays = new Set<string>();
    const transList: { from: string }[] = Array.isArray(raw.transitions) ? raw.transitions : [];
    for (const tr of transList) {
      if (!tr.from) continue;
      const [dd, mm] = tr.from.split('.');
      const date = `${year}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
      workdays.add(date);
    }

    // ── Нерабочие и сокращённые дни из months[].days ─────────
    const months: { month: number; days: string }[] =
      Array.isArray(raw.months) ? raw.months : [];

    for (const monthObj of months) {
      const m    = monthObj.month;
      const dStr = monthObj.days ?? '';
      if (!m || !dStr) continue;

      for (const token of dStr.split(',')) {
        const trimmed  = token.trim();
        const isShort  = trimmed.endsWith('+');
        // '*' = перенесённый выходной, обрабатываем как обычный нерабочий
        const cleaned  = trimmed.replace(/[^0-9]/g, '');
        const dayNum   = parseInt(cleaned, 10);
        if (!dayNum || dayNum < 1 || dayNum > 31) continue;

        const date    = `${year}-${String(m).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
        const dateObj = new Date(date + 'T00:00:00');
        const dow     = dateObj.getDay(); // 0=Sun 6=Sat

        if (isShort) {
          // Предпраздничный сокращённый день (число+)
          entries.push({ date, name: '', type: 'shortday' });
        } else if (workdays.has(date)) {
          // Рабочая суббота (перенос)
          entries.push({ date, name: '', type: 'workday' });
        } else if (dow >= 1 && dow <= 5) {
          // Рабочий день в будни, но нерабочий по календарю → праздник (мосты, переносы)
          entries.push({ date, name: '', type: 'holiday' });
        }
        // Обычные Сб/Вс пропускаем — фронтенд добавляет все 14 праздников через BUILTIN
      }
    }

    this.logger.log(`Parsed ${entries.length} entries for ${year}`);
    return entries;
  }
}
