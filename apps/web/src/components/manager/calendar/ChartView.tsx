'use client';

import { useMemo, useState } from 'react';
import { Task, toDateStr } from '../../../lib/tasks';
import { HolidayMap } from '../../../lib/holidays';
import {
  WEEKDAYS, MONTHS, MONTHS_SHORT, MONTHS_GEN, QUARTERS,
  ChartPeriod, PERIOD_LABELS, PickerType,
  getWeekDays,
} from '../../../lib/calendarLayout';
import { PickerPanel } from './PickerPanel';
import { TimeGridView } from './TimeGridView';
import { SpanMonthView } from './SpanMonthView';
import { YearView } from './YearView';
import styles from './Calendar.module.scss';

interface ChartProps { selectedDate: Date; tasks: Task[]; onSelect: (d: Date) => void; holidayMap?: HolidayMap; }

export function ChartView({ selectedDate, tasks, onSelect, holidayMap }: ChartProps) {
  const [period,      setPeriod]      = useState<ChartPeriod>('week');
  const [chartPicker, setChartPicker] = useState<PickerType | null>(null);

  const today    = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

  const navigate = (dir: 1 | -1) => {
    const d = new Date(selectedDate);
    switch (period) {
      case 'day':     d.setDate(d.getDate() + dir);         break;
      case 'week':    d.setDate(d.getDate() + dir * 7);     break;
      case 'month':   d.setMonth(d.getMonth() + dir);       break;
      case 'quarter': d.setMonth(d.getMonth() + dir * 3);   break;
      case 'year':    d.setFullYear(d.getFullYear() + dir); break;
    }
    onSelect(d);
  };

  const handleChartPick = (month: number, year: number) => {
    const d = new Date(year, month, 1); d.setHours(0,0,0,0); onSelect(d);
    setChartPicker(null);
  };

  const navLabel = (() => {
    switch (period) {
      case 'day': {
        const t = new Date(); t.setHours(0,0,0,0);
        const isTodaySel = selectedDate.getTime() === t.getTime();
        const dateStr = `${selectedDate.getDate()} ${MONTHS_GEN[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
        return isTodaySel ? `Сегодня: ${dateStr}` : dateStr;
      }
      case 'week': {
        const f = weekDays[0], l = weekDays[6];
        if (f.getMonth() === l.getMonth())
          return `${f.getDate()}–${l.getDate()} ${MONTHS_GEN[f.getMonth()]} ${f.getFullYear()}`;
        return `${f.getDate()} ${MONTHS_GEN[f.getMonth()]} – ${l.getDate()} ${MONTHS_GEN[l.getMonth()]} ${l.getFullYear()}`;
      }
      case 'month':   return `${MONTHS[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
      case 'quarter': return `${QUARTERS[Math.floor(selectedDate.getMonth()/3)]} ${selectedDate.getFullYear()}`;
      case 'year':    return `${selectedDate.getFullYear()}`;
    }
  })();

  const qStart        = Math.floor(selectedDate.getMonth() / 3) * 3;
  const quarterMonths = [0,1,2].map(i => ({ year: selectedDate.getFullYear(), month: qStart + i }));
  const yearMonths    = Array.from({ length: 12 }, (_, i) => ({ year: selectedDate.getFullYear(), month: i }));

  const todStr = toDateStr(today);
  const selStr = toDateStr(selectedDate);

  return (
    <div className={styles.chart}>
      {/* Nav row */}
      <div className={styles.chartNavRow}>
        <div className={styles.chartNavLeft}>
          <button className={styles.navBtn} onClick={() => navigate(-1)} aria-label="Назад">‹</button>
          <span className={styles.chartWeekLabel}>{navLabel}</span>
          <button className={styles.navBtn} onClick={() => navigate(1)} aria-label="Вперёд">›</button>

          {/* Month/Year pickers for chart */}
          <div className={styles.chartPickerGroup}>
            {period !== 'year' && (
              <div className={styles.pickerWrap}>
                <button
                  className={[styles.navPickerBtn, chartPicker === 'month' ? styles.navPickerBtnActive : ''].join(' ')}
                  onClick={() => setChartPicker(p => p === 'month' ? null : 'month')}
                >
                  {MONTHS_SHORT[selectedDate.getMonth()]} ▾
                </button>
                {chartPicker === 'month' && (
                  <PickerPanel
                    type="month"
                    currentMonth={selectedDate.getMonth()}
                    currentYear={selectedDate.getFullYear()}
                    onPick={handleChartPick}
                    onClose={() => setChartPicker(null)}
                  />
                )}
              </div>
            )}
            <div className={styles.pickerWrap}>
              <button
                className={[styles.navPickerBtn, chartPicker === 'year' ? styles.navPickerBtnActive : ''].join(' ')}
                onClick={() => setChartPicker(p => p === 'year' ? null : 'year')}
              >
                {selectedDate.getFullYear()} ▾
              </button>
              {chartPicker === 'year' && (
                <PickerPanel
                  type="year"
                  currentMonth={selectedDate.getMonth()}
                  currentYear={selectedDate.getFullYear()}
                  onPick={handleChartPick}
                  onClose={() => setChartPicker(null)}
                />
              )}
            </div>
          </div>
        </div>

        <div className={styles.chartPeriods}>
          {(Object.keys(PERIOD_LABELS) as ChartPeriod[]).map(p => (
            <button key={p}
              className={[styles.periodBtn, period === p ? styles.periodBtnActive : ''].join(' ')}
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Day ── */}
      {period === 'day' && (
        <TimeGridView days={[selectedDate]} tasks={tasks} selectedDate={selectedDate} onSelect={onSelect} holidayMap={holidayMap} />
      )}

      {/* ── Week ── */}
      {period === 'week' && (
        <TimeGridView days={weekDays} tasks={tasks} selectedDate={selectedDate} onSelect={onSelect} holidayMap={holidayMap} showWeekNum />
      )}

      {period === 'month' && (
        <div className={styles.chartSingleMonth}>
          <SpanMonthView year={selectedDate.getFullYear()} month={selectedDate.getMonth()} tasks={tasks} selectedDate={selectedDate} onSelect={onSelect} holidayMap={holidayMap} />
        </div>
      )}
      {period === 'quarter' && (
        <div className={styles.chartQuarterStack}>
          <div className={styles.spanMonthHead}>
            {WEEKDAYS.map(d => <span key={d} className={styles.spanMonthWd}>{d}</span>)}
          </div>
          {quarterMonths.map(({ year, month }) => (
            <SpanMonthView key={month} year={year} month={month} tasks={tasks} selectedDate={selectedDate} onSelect={onSelect} holidayMap={holidayMap} showMonthLabel />
          ))}
        </div>
      )}
      {period === 'year' && (
        <div className={styles.chartYearWrap}>
          <YearView year={selectedDate.getFullYear()} tasks={tasks} selectedDate={selectedDate} onSelect={onSelect} holidayMap={holidayMap} />
        </div>
      )}
    </div>
  );
}
