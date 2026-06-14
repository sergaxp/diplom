import { describe, it, expect } from 'vitest';
import { parseDayDetail, computeBestWindow, type HourlyPoint } from './weather';

const hp = (over: Partial<HourlyPoint>): HourlyPoint => ({
  time: '2026-06-16T12:00', hour: 12, temp: 21, feelsLike: 21, precipProb: 0,
  precip: 0, weatherCode: 0, windSpeed: 5, windGusts: 8, windDir: 180,
  humidity: 50, pressure: 1012, isDay: true, ...over,
});

describe('parseDayDetail', () => {
  const date = '2026-06-16';

  const forecastJson = {
    daily: {
      time: [date],
      sunrise: [`${date}T04:12`],
      sunset: [`${date}T22:48`],
      daylight_duration: [67000],
      uv_index_max: [6],
      wind_gusts_10m_max: [34],
    },
    hourly: {
      time: [
        `${date}T00:00`, `${date}T01:00`, `${date}T02:00`,
        // лишний день — должен быть отфильтрован
        '2026-06-17T00:00',
      ],
      temperature_2m: [12.4, 11.8, null, 20.1],
      apparent_temperature: [10.9, 10.2, 9.8, 19.0],
      precipitation: [0, 0.24, 0.0, 1.2],
      precipitation_probability: [5, 40, 60, 80],
      weathercode: [3, 61, 61, 0],
      wind_speed_10m: [8.2, 9.9, 10.1, 5.0],
      wind_gusts_10m: [15, 18, 19, 9],
      wind_direction_10m: [180, 200, 210, 90],
      relative_humidity_2m: [70, 75, 80, 50],
      surface_pressure: [1012.4, 1011.9, 1011.5, 1015.0],
      is_day: [0, 0, 1, 1],
    },
  };

  it('оставляет только часы запрошенной даты', () => {
    const r = parseDayDetail(forecastJson, date)!;
    // 3 часа даты, но один с temp=null отбрасывается → 2
    expect(r.hours).toHaveLength(2);
    expect(r.hours.every(h => h.time.startsWith(date))).toBe(true);
  });

  it('корректно маппит и округляет поля', () => {
    const r = parseDayDetail(forecastJson, date)!;
    const h0 = r.hours[0];
    expect(h0).toMatchObject({
      hour: 0, temp: 12, feelsLike: 11, precipProb: 5,
      precip: 0, weatherCode: 3, windSpeed: 8, isDay: false,
    });
    expect(r.hours[1].precip).toBe(0.2); // 0.24 → 0.2
  });

  it('разбирает суточные экстра-поля', () => {
    const r = parseDayDetail(forecastJson, date)!;
    expect(r.sunrise).toBe(`${date}T04:12`);
    expect(r.uvIndexMax).toBe(6);
    expect(r.windGustsMax).toBe(34);
  });

  it('precipProb = null когда поля нет (архив ERA5)', () => {
    const archiveJson = {
      daily: { time: [date] },
      hourly: {
        time: [`${date}T00:00`],
        temperature_2m: [9.0],
        apparent_temperature: [8.0],
        precipitation: [0],
        weathercode: [1],
        wind_speed_10m: [6],
        is_day: [1],
      },
    };
    const r = parseDayDetail(archiveJson, date)!;
    expect(r.hours[0].precipProb).toBeNull();
    expect(r.hours[0].isDay).toBe(true);
  });

  it('возвращает null без почасовых данных', () => {
    expect(parseDayDetail({ daily: { time: [date] } }, date)).toBeNull();
    expect(parseDayDetail(null, date)).toBeNull();
    // все часы — другой день
    expect(parseDayDetail({ hourly: { time: ['2026-06-17T00:00'], temperature_2m: [10] } }, date)).toBeNull();
  });
});

describe('computeBestWindow', () => {
  it('выбирает самый комфортный сухой час', () => {
    const hours = [
      hp({ hour: 9, feelsLike: 14, precipProb: 10 }),
      hp({ hour: 12, feelsLike: 21, precipProb: 0 }), // лучший
      hp({ hour: 15, feelsLike: 28, precipProb: 0 }),
      hp({ hour: 18, feelsLike: 20, precipProb: 70 }), // дождь
    ];
    const r = computeBestWindow(hours)!;
    expect(r.bestHour).toBe(12);
    expect(r.reason).toContain('комфорт');
  });

  it('расширяет окно по подряд идущим сухим часам, обрывается на дожде', () => {
    const hours = [
      hp({ hour: 10, feelsLike: 20, precipProb: 0 }),
      hp({ hour: 11, feelsLike: 21, precipProb: 5 }),
      hp({ hour: 12, feelsLike: 22, precipProb: 10 }),
      hp({ hour: 13, feelsLike: 21, precipProb: 80 }), // дождь — граница
    ];
    const r = computeBestWindow(hours)!;
    expect(r.startHour).toBe(10);
    expect(r.endHour).toBe(12);
  });

  it('учитывает погодное условие задачи (skipRain) — берёт только сухие часы', () => {
    const hours = [
      hp({ hour: 12, feelsLike: 21, weatherCode: 61 }), // дождь по коду
      hp({ hour: 15, feelsLike: 25, weatherCode: 0 }),  // ясно
    ];
    const r = computeBestWindow(hours, { skipRain: true })!;
    expect(r.bestHour).toBe(15);
    expect(r.reason).toContain('условие');
  });

  it('возвращает null, если ни один час не проходит условие', () => {
    const hours = [hp({ hour: 12, weatherCode: 61 }), hp({ hour: 15, weatherCode: 80 })];
    expect(computeBestWindow(hours, { skipRain: true })).toBeNull();
  });

  it('пустой ввод → null', () => {
    expect(computeBestWindow([])).toBeNull();
  });
});
