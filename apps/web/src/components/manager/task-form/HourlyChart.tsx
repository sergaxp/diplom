'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { HourlyPoint } from '../../../lib/weather';
import { useWeatherPrefs } from '../../../store/weatherPrefsStore';
import { fmtTemp, tempVal } from '../../../lib/weatherUnits';
import styles from './HourlyChart.module.scss';

const HEIGHT = 180;
const PAD = { top: 16, right: 10, bottom: 24, left: 28 };

interface HourlyChartProps {
  hours: HourlyPoint[];
  /** Подсветить «лучшее окно» дня (границы по часам). */
  highlight?: { startHour: number; endHour: number };
}

export function HourlyChart({ hours, highlight }: HourlyChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [idx, setIdx] = useState<number | null>(null);
  const tempUnit = useWeatherPrefs(s => s.units.temp);

  // Ширину берём из DOM (ResizeObserver), рисуем SVG в реальных px → линии не
  // искажаются (без растяжения viewBox).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = hours.length;

  const geo = useMemo(() => {
    if (width <= 0 || n < 2) return null;
    const innerW = width - PAD.left - PAD.right;
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    const step = innerW / (n - 1);

    const vals = hours.flatMap(h => [h.temp, h.feelsLike]);
    let tMin = Math.min(...vals);
    let tMax = Math.max(...vals);
    if (tMin === tMax) { tMin -= 1; tMax += 1; }
    const padT = Math.max(1, Math.round((tMax - tMin) * 0.15));
    tMin -= padT; tMax += padT;

    const x = (i: number) => PAD.left + i * step;
    const yT = (t: number) => PAD.top + (1 - (t - tMin) / (tMax - tMin)) * innerH;

    const baseline = PAD.top + innerH;
    const precipBandH = innerH * 0.35;
    const hasPrecip = hours.some(h => h.precipProb != null);

    const tempLine = hours.map((h, i) => `${x(i)},${yT(h.temp)}`).join(' ');
    const feelsLine = hours.map((h, i) => `${x(i)},${yT(h.feelsLike)}`).join(' ');

    // Ночные часы — затенённые полосы (по is_day).
    const nightRects: { x: number; w: number }[] = [];
    hours.forEach((h, i) => {
      if (h.isDay) return;
      const left = Math.max(PAD.left, x(i) - step / 2);
      const right = Math.min(PAD.left + innerW, x(i) + step / 2);
      nightRects.push({ x: left, w: Math.max(0, right - left) });
    });

    return { innerW, innerH, step, tMin, tMax, x, yT, baseline, precipBandH, hasPrecip, tempLine, feelsLine, nightRects };
  }, [width, n, hours]);

  if (n < 2) {
    return <div ref={wrapRef} className={styles.wrap}><p className={styles.empty}>Почасовой прогноз недоступен</p></div>;
  }

  const active = idx != null ? hours[idx] : null;

  const onPointer = (e: React.PointerEvent<SVGRectElement>) => {
    if (!geo) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.round((e.clientX - rect.left) / (rect.width / (n - 1)));
    setIdx(Math.max(0, Math.min(n - 1, i)));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft')  { setIdx(p => Math.max(0, (p ?? 0) - 1)); e.preventDefault(); }
    if (e.key === 'ArrowRight') { setIdx(p => Math.min(n - 1, (p ?? 0) + 1)); e.preventDefault(); }
    if (e.key === 'Escape') setIdx(null);
  };

  const hl = highlight && geo ? (() => {
    const si = hours.findIndex(h => h.hour === highlight.startHour);
    const ei = hours.findIndex(h => h.hour === highlight.endHour);
    if (si < 0 || ei < 0) return null;
    const left = Math.max(PAD.left, geo.x(si) - geo.step / 2);
    const right = Math.min(PAD.left + geo.innerW, geo.x(ei) + geo.step / 2);
    return { x: left, w: Math.max(0, right - left) };
  })() : null;

  const tMaxAll = Math.max(...hours.map(h => h.temp));
  const tMinAll = Math.min(...hours.map(h => h.temp));
  const probMax = Math.max(...hours.map(h => h.precipProb ?? 0));
  const ariaSummary =
    `Почасовой прогноз на ${n} ч: температура от ${fmtTemp(tMinAll, tempUnit)} до ${fmtTemp(tMaxAll, tempUnit)}` +
    (geo?.hasPrecip ? `, макс. вероятность осадков ${probMax}%` : '');

  return (
    <div
      ref={wrapRef}
      className={styles.wrap}
      tabIndex={0}
      role="img"
      aria-label={ariaSummary}
      onKeyDown={onKeyDown}
    >
      {geo && (
        <svg width={width} height={HEIGHT} className={styles.svg} aria-hidden="true">
          {/* Ночь */}
          {geo.nightRects.map((r, i) => (
            <rect key={i} x={r.x} y={PAD.top} width={r.w} height={geo.innerH} className={styles.night} />
          ))}

          {/* Лучшее окно */}
          {hl && <rect x={hl.x} y={PAD.top} width={hl.w} height={geo.innerH} className={styles.highlight} />}

          {/* Подписи температурной оси */}
          <text x={4} y={geo.yT(geo.tMax) + 4} className={styles.axisLabel}>{tempVal(Math.round(geo.tMax), tempUnit)}°</text>
          <text x={4} y={geo.yT(geo.tMin) + 4} className={styles.axisLabel}>{tempVal(Math.round(geo.tMin), tempUnit)}°</text>

          {/* Столбики вероятности осадков */}
          {geo.hasPrecip && hours.map((h, i) => {
            if (h.precipProb == null || h.precipProb <= 0) return null;
            const bh = (h.precipProb / 100) * geo.precipBandH;
            const bw = Math.max(2, geo.step * 0.55);
            return <rect key={i} x={geo.x(i) - bw / 2} y={geo.baseline - bh} width={bw} height={bh} className={styles.precipBar} />;
          })}

          {/* Линии температуры и «ощущается» */}
          <polyline points={geo.feelsLine} className={styles.feelsLine} />
          <polyline points={geo.tempLine} className={styles.tempLine} />

          {/* Тики по X каждые 3 часа */}
          {hours.map((h, i) =>
            h.hour % 3 === 0 ? (
              <text key={i} x={geo.x(i)} y={HEIGHT - 8} className={styles.hourLabel}>{h.hour}</text>
            ) : null,
          )}

          {/* Курсор */}
          {active && idx != null && (
            <>
              <line x1={geo.x(idx)} y1={PAD.top} x2={geo.x(idx)} y2={geo.baseline} className={styles.cursorLine} />
              <circle cx={geo.x(idx)} cy={geo.yT(active.temp)} r={4} className={styles.cursorDot} />
            </>
          )}

          {/* Прозрачный слой для наведения/тача (touch-action в scss) */}
          <rect
            x={PAD.left} y={PAD.top} width={geo.innerW} height={geo.innerH}
            className={styles.hitArea}
            onPointerMove={onPointer}
            onPointerDown={onPointer}
            onPointerLeave={() => setIdx(null)}
          />
        </svg>
      )}

      {active && geo && (
        <div
          className={styles.tooltip}
          style={{ left: Math.min(Math.max(geo.x(idx!), 60), width - 60) }}
        >
          <span className={styles.tooltipHour}>{String(active.hour).padStart(2, '0')}:00</span>
          <span className={styles.tooltipTemp}>{fmtTemp(active.temp, tempUnit)} <i>ощущ. {fmtTemp(active.feelsLike, tempUnit)}</i></span>
          {active.precipProb != null && <span>Осадки {active.precipProb}% · {active.precip} мм</span>}
          <span>Ветер {active.windSpeed} км/ч</span>
        </div>
      )}

      {/* Доступная альтернатива графику для скринридеров */}
      <table className={styles.srTable}>
        <caption>{ariaSummary}</caption>
        <thead><tr><th>Час</th><th>Темп.</th><th>Ощущается</th><th>Осадки</th><th>Ветер</th></tr></thead>
        <tbody>
          {hours.map(h => (
            <tr key={h.time}>
              <td>{String(h.hour).padStart(2, '0')}:00</td>
              <td>{fmtTemp(h.temp, tempUnit)}</td>
              <td>{fmtTemp(h.feelsLike, tempUnit)}</td>
              <td>{h.precipProb != null ? `${h.precipProb}%` : '—'}</td>
              <td>{h.windSpeed} км/ч</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
