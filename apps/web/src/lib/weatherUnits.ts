import type { TempUnit, WindUnit, PressureUnit } from '../store/weatherPrefsStore';

// Данные везде хранятся в метрических единицах (°C, км/ч, гПа).
// Конвертация — только на отображении, по выбранной пользователем единице.

export function toTemp(c: number, u: TempUnit): number {
  return u === 'f' ? Math.round((c * 9) / 5 + 32) : Math.round(c);
}

/** Со знаком и градусом: «+21°», «-3°F». */
export function fmtTemp(c: number, u: TempUnit): string {
  const v = toTemp(c, u);
  return `${v > 0 ? '+' : ''}${v}°${u === 'f' ? 'F' : ''}`;
}

/** Только число (для оси графика, где ° рисуется отдельно). */
export function tempVal(c: number, u: TempUnit): number {
  return toTemp(c, u);
}

export function fmtWind(kmh: number, u: WindUnit): string {
  return u === 'ms' ? `${Math.round(kmh / 3.6)} м/с` : `${kmh} км/ч`;
}

export function fmtPressure(hpa: number, u: PressureUnit): string {
  return u === 'mmhg' ? `${Math.round(hpa * 0.750062)} мм рт.ст.` : `${hpa} гПа`;
}
