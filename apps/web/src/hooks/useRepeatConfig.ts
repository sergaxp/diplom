'use client';

import { useState } from 'react';
import { RepeatConfig, CyclicSegment } from '../lib/tasks';
import {
  RepeatMode,
  parseInitialConfig,
  buildRepeatConfig,
  calcMinEvery,
  cycleTotalDays,
  addDaysStr,
  type BuiltRepeatConfig,
} from '../lib/repeatConfig';

interface UseRepeatConfigArgs {
  initial?: RepeatConfig | null;
  selectedDate: string;
  /** Конечная дата задачи (для multiDay) – нужна для расчёта min значений */
  taskEndDate?: string;
  multiDay?: boolean;
}

type Unit = 'day' | 'week' | 'month' | 'year';

export function useRepeatConfig({ initial, selectedDate, taskEndDate, multiDay = false }: UseRepeatConfigArgs) {
  const startDow = new Date(selectedDate + 'T00:00:00').getDay();

  /** Минимально допустимое «до даты» (день после даты конца / даты начала) */
  const baseEndForUntil = multiDay && taskEndDate ? taskEndDate : selectedDate;
  const minRepeatUntil = addDaysStr(baseEndForUntil, 1);

  /** Минимально допустимое «каждые N» для произвольной единицы при multiDay */
  const minEveryFor = (u: Unit) =>
    multiDay && taskEndDate ? calcMinEvery(u, selectedDate, taskEndDate) : 1;

  // Считаем начальное состояние формы из initial один раз — заменяет init useEffect
  const [initialState] = useState(() => parseInitialConfig(initial, selectedDate, multiDay, startDow));

  // ── Расписание ─────────────────────────────────────────────
  const [mode, setMode] = useState<RepeatMode>(initialState.mode);

  const [every, setEvery] = useState(initialState.every);
  const [unit,  setUnit]  = useState<Unit>(initialState.unit);
  const currentMinEvery = minEveryFor(unit);
  const [weekdays,     setWeekdays]     = useState<number[]>(initialState.weekdays);
  const [skipWeekends, setSkipWeekends] = useState(initialState.skipWeekends);

  const [cyclicPattern, setCyclicPattern] = useState<CyclicSegment[]>(initialState.cyclicPattern);

  const [dependencyDays, setDependencyDays] = useState(initialState.dependencyDays);

  const [monthDays, setMonthDays] = useState<number[]>(initialState.monthDays);
  const daysInSelMonth = (() => {
    const d = new Date(selectedDate + 'T00:00:00');
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  })();
  const toggleMonthDay = (n: number) =>
    setMonthDays(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n].sort((a, b) => a - b));

  // ── Условия ────────────────────────────────────────────────
  const [useHolidays,    setUseHolidays]    = useState(initialState.useHolidays);
  const [skipHolidays,   setSkipHolidays]   = useState(initialState.skipHolidays);
  const [onlyOnHolidays, setOnlyOnHolidays] = useState(initialState.onlyOnHolidays);

  const [useWeather,    setUseWeather]    = useState(initialState.useWeather);
  const [skipRain,      setSkipRain]      = useState(initialState.skipRain);
  const [skipSnow,      setSkipSnow]      = useState(initialState.skipSnow);
  const [skipStorm,     setSkipStorm]     = useState(initialState.skipStorm);
  const [skipFog,       setSkipFog]       = useState(initialState.skipFog);
  const [skipCloudy,    setSkipCloudy]    = useState(initialState.skipCloudy);
  const [requireClear,  setRequireClear]  = useState(initialState.requireClear);
  const [minTempDay,    setMinTempDay]    = useState(initialState.minTempDay);
  const [maxTempDay,    setMaxTempDay]    = useState(initialState.maxTempDay);
  const [minTempNight,  setMinTempNight]  = useState(initialState.minTempNight);
  const [maxTempNight,  setMaxTempNight]  = useState(initialState.maxTempNight);

  const [useSeasonal, setUseSeasonal] = useState(initialState.useSeasonal);
  const [months,      setMonths]      = useState<number[]>(initialState.months);

  // ── Конфликт #4: scope условий для многодневных задач ──────
  const [conditionScope, setConditionScope] = useState<'perDay' | 'whole'>(initialState.conditionScope);

  // ── Завершение ─────────────────────────────────────────────
  const [endMode,  setEndMode]  = useState(initialState.endMode);
  const [endAfter, setEndAfter] = useState(initialState.endAfter);
  const [endDate,  setEndDate]  = useState(initialState.endDate);

  // ── Нормализация при multiDay (adjust state during render — без эффектов) ──
  // Если включён multiDay — заблокировать cyclic / dependency / monthdays
  const [prevMultiDay, setPrevMultiDay] = useState(multiDay);
  if (multiDay !== prevMultiDay) {
    setPrevMultiDay(multiDay);
    if (multiDay && mode !== 'interval') setMode('interval');
  }

  // При multiDay подтягиваем every до безопасного минимума, когда минимум меняется
  const [prevMinEvery, setPrevMinEvery] = useState(currentMinEvery);
  if (currentMinEvery !== prevMinEvery) {
    setPrevMinEvery(currentMinEvery);
    if (multiDay && mode === 'interval' && every < currentMinEvery) {
      setEvery(currentMinEvery);
    }
  }

  // ── Helpers ────────────────────────────────────────────────
  const toggleWeekday = (d: number) =>
    setWeekdays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const toggleMonth = (m: number) =>
    setMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m].sort((a, b) => a - b));

  const setSeasonMonths = (seasonMonths: number[]) => {
    setMonths(prev => {
      const allSelected = seasonMonths.every(m => prev.includes(m));
      if (allSelected) return prev.filter(m => !seasonMonths.includes(m));
      const merged = [...new Set([...prev, ...seasonMonths])].sort((a, b) => a - b);
      return merged;
    });
  };

  const clearMonths = () => setMonths([]);

  const updateCyclic = (idx: number, field: keyof CyclicSegment, val: number) =>
    setCyclicPattern(prev => prev.map((s, i) => i === idx ? { ...s, [field]: Math.max(0, val) } : s));

  const addCyclicSegment = () =>
    setCyclicPattern(prev => [...prev, { active: 1, rest: 1 }]);

  const removeCyclicSegment = (idx: number) =>
    setCyclicPattern(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);

  const selectUnit = (u: Unit) => {
    setUnit(u);
    // При смене единицы подтягиваем every до её минимума
    const m = minEveryFor(u);
    if (every < m) setEvery(m);
  };

  const onEveryChange = (raw: string) =>
    setEvery(Math.max(currentMinEvery, parseInt(raw) || currentMinEvery));

  // ── Превью паттерна ────────────────────────────────────────
  const cyclicPreview = (() => {
    const total = cycleTotalDays(cyclicPattern);
    if (total === 0) return null;
    const parts = cyclicPattern.map(s => {
      const a = s.active > 0 ? `${s.active} дн.` : '';
      const r = s.rest   > 0 ? `${s.rest} пауза` : '';
      return [a, r].filter(Boolean).join(' + ');
    });
    return `${parts.join(' → ')}  =  ${total} дней в цикле`;
  })();

  const getResult = (): BuiltRepeatConfig => buildRepeatConfig({
    mode, every, unit, weekdays, skipWeekends, cyclicPattern, dependencyDays, monthDays,
    useHolidays, skipHolidays, onlyOnHolidays,
    useWeather, skipRain, skipSnow, skipStorm, skipFog, skipCloudy, requireClear,
    minTempDay, maxTempDay, minTempNight, maxTempNight,
    useSeasonal, months, conditionScope,
    endMode, endAfter, endDate,
    multiDay, selectedDate,
  });

  return {
    startDow,
    minRepeatUntil,
    currentMinEvery,
    daysInSelMonth,
    cyclicPreview,

    mode, setMode,
    every, setEvery, onEveryChange,
    unit, setUnit, selectUnit,
    weekdays, setWeekdays, toggleWeekday,
    skipWeekends, setSkipWeekends,

    cyclicPattern, setCyclicPattern, updateCyclic, addCyclicSegment, removeCyclicSegment,

    dependencyDays, setDependencyDays,

    monthDays, setMonthDays, toggleMonthDay,

    useHolidays, setUseHolidays,
    skipHolidays, setSkipHolidays,
    onlyOnHolidays, setOnlyOnHolidays,

    useWeather, setUseWeather,
    skipRain, setSkipRain,
    skipSnow, setSkipSnow,
    skipStorm, setSkipStorm,
    skipFog, setSkipFog,
    skipCloudy, setSkipCloudy,
    requireClear, setRequireClear,
    minTempDay, setMinTempDay,
    maxTempDay, setMaxTempDay,
    minTempNight, setMinTempNight,
    maxTempNight, setMaxTempNight,

    useSeasonal, setUseSeasonal,
    months, setMonths, toggleMonth, setSeasonMonths, clearMonths,

    conditionScope, setConditionScope,

    endMode, setEndMode,
    endAfter, setEndAfter,
    endDate, setEndDate,

    getResult,
  };
}

export type UseRepeatConfigResult = ReturnType<typeof useRepeatConfig>;
