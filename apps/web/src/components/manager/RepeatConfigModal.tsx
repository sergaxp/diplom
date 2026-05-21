'use client';

import { useEffect, useState } from 'react';
import { RepeatConfig, CyclicSegment, WeatherCondition, HolidaySettings } from '../../lib/tasks';
import styles from './RepeatConfigModal.module.scss';

type Mode = 'interval' | 'cyclic' | 'dependency' | 'adaptive';

const WEEKDAYS = [
  { v: 1, s: 'Пн' }, { v: 2, s: 'Вт' }, { v: 3, s: 'Ср' },
  { v: 4, s: 'Чт' }, { v: 5, s: 'Пт' }, { v: 6, s: 'Сб' }, { v: 0, s: 'Вс' },
];

const MONTHS_SHORT = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
const SEASONS: Array<{ label: string; months: number[] }> = [
  { label: 'Весна', months: [3, 4, 5]   },
  { label: 'Лето',  months: [6, 7, 8]   },
  { label: 'Осень', months: [9, 10, 11] },
  { label: 'Зима',  months: [12, 1, 2]  },
];

const UNIT_OPTS = [
  { v: 'day',   one: 'день',    few: 'дня',    many: 'дней'    },
  { v: 'week',  one: 'неделю',  few: 'недели', many: 'недель'  },
  { v: 'month', one: 'месяц',   few: 'месяца', many: 'месяцев' },
  { v: 'year',  one: 'год',     few: 'года',   many: 'лет'     },
] as const;

function unitLabel(v: RepeatConfig['unit'], n: number): string {
  const u = UNIT_OPTS.find(o => o.v === v)!;
  if (n % 10 === 1 && n % 100 !== 11) return u.one;
  if (n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14)) return u.few;
  return u.many;
}

function cycleTotalDays(pattern: CyclicSegment[]): number {
  return pattern.reduce((s, p) => s + p.active + p.rest, 0);
}

interface Props {
  initial?: RepeatConfig | null;
  selectedDate: string;
  /** Конечная дата задачи (для multiDay) — нужна для расчёта min значений */
  taskEndDate?: string;
  multiDay?: boolean;
  onSave: (cfg: RepeatConfig, repeatUntil?: string) => void;
  onClose: () => void;
}

/** Прибавить N дней к YYYY-MM-DD и вернуть YYYY-MM-DD */
function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const RU_MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const RU_WD_SHORT = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 6×7 сетка дней месяца, понедельник первым; null для «пустых» ячеек */
function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length < 42) cells.push(null);
  return cells;
}

interface MiniCalProps {
  value: string;
  minDate: string;
  onChange: (iso: string) => void;
}

function MiniCalendar({ value, minDate, onChange }: MiniCalProps) {
  const seed = value || minDate;
  const seedDate = new Date(seed + 'T00:00:00');
  const minD     = new Date(minDate + 'T00:00:00');

  const [viewYear,  setViewYear]  = useState(seedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(seedDate.getMonth());

  const cells = buildMonthGrid(viewYear, viewMonth);
  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  return (
    <div className={styles.miniCal}>
      <div className={styles.miniCalHead}>
        <button type="button" className={styles.miniCalNav} onClick={prevMonth}>‹</button>
        <span className={styles.miniCalTitle}>{RU_MONTHS[viewMonth]} {viewYear}</span>
        <button type="button" className={styles.miniCalNav} onClick={nextMonth}>›</button>
      </div>
      <div className={styles.miniCalWds}>
        {RU_WD_SHORT.map(w => <span key={w} className={styles.miniCalWd}>{w}</span>)}
      </div>
      <div className={styles.miniCalGrid}>
        {cells.map((d, i) => {
          if (!d) return <span key={i} className={styles.miniCalEmpty} />;
          const iso = toIso(d);
          const isDisabled = d < minD;
          const isSelected = iso === value;
          return (
            <button
              key={i}
              type="button"
              disabled={isDisabled}
              className={`${styles.miniCalCell} ${isSelected ? styles.miniCalCellSelected : ''}`}
              onClick={() => onChange(iso)}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Минимально допустимый «каждые N» для multi-day задачи: «buffer ≥ 1 day»,
 * т.е. следующее вхождение начинается СТРОГО после окончания текущего
 * (back-to-back). Buffer = K - durationDays для day; для остальных единиц —
 * наименьшее N такое, что start + N*unit > end.
 *
 * Для 0-длительности (start == end) даёт 1 во всех единицах — позволяет
 * выставить «Каждый день / неделю / месяц / год».
 */
function calcMinEvery(unit: 'day' | 'week' | 'month' | 'year', startStr: string, endStr: string): number {
  const start = new Date(startStr + 'T00:00:00');
  const end   = new Date(endStr   + 'T00:00:00');
  const durMs = end.getTime() - start.getTime();
  const durDays = Math.max(0, Math.round(durMs / 86_400_000));

  switch (unit) {
    case 'day':  return Math.max(1, durDays + 1);                     // back-to-back
    case 'week': return Math.max(1, Math.ceil((durDays + 1) / 7));     // ближайшая неделя без перекрытия
    case 'month': {
      let n = 1;
      while (true) {
        const next = new Date(start);
        next.setMonth(next.getMonth() + n);
        if (next > end) break;
        n++;
        if (n > 120) break;
      }
      return n;
    }
    case 'year': {
      let n = 1;
      while (true) {
        const next = new Date(start);
        next.setFullYear(next.getFullYear() + n);
        if (next > end) break;
        n++;
        if (n > 100) break;
      }
      return n;
    }
  }
}

export function RepeatConfigModal({ initial, selectedDate, taskEndDate, multiDay = false, onSave, onClose }: Props) {
  const startDow = new Date(selectedDate + 'T00:00:00').getDay();

  /** Минимально допустимое «до даты» (день после даты конца / даты начала) */
  const baseEndForUntil = multiDay && taskEndDate ? taskEndDate : selectedDate;
  const minRepeatUntil = addDaysStr(baseEndForUntil, 1);

  /** Минимально допустимое «каждые N» для произвольной единицы при multiDay */
  const minEveryFor = (u: 'day' | 'week' | 'month' | 'year') =>
    multiDay && taskEndDate ? calcMinEvery(u, selectedDate, taskEndDate) : 1;

  // ── Расписание ─────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>('interval');

  // Интервальный режим
  const [every,        setEvery]        = useState(1);
  const [unit,         setUnit]         = useState<NonNullable<RepeatConfig['unit']>>('day');
  const currentMinEvery = minEveryFor(unit);
  const [weekdays,     setWeekdays]     = useState<number[]>([startDow]);
  const [skipWeekends, setSkipWeekends] = useState(false);

  // Цикличный режим
  const [cyclicPattern, setCyclicPattern] = useState<CyclicSegment[]>([{ active: 1, rest: 1 }]);

  // Режим «после выполнения»
  const [dependencyDays, setDependencyDays] = useState(7);

  // ── Условия ────────────────────────────────────────────────
  const [useHolidays,    setUseHolidays]    = useState(false);
  const [skipHolidays,   setSkipHolidays]   = useState(true);
  const [onlyOnHolidays, setOnlyOnHolidays] = useState(false);

  const [useWeather,    setUseWeather]    = useState(false);
  const [skipRain,      setSkipRain]      = useState(false);
  const [skipSnow,      setSkipSnow]      = useState(false);
  const [skipStorm,     setSkipStorm]     = useState(false);
  const [skipFog,       setSkipFog]       = useState(false);
  const [skipCloudy,    setSkipCloudy]    = useState(false);
  const [requireClear,  setRequireClear]  = useState(false);
  const [minTempDay,    setMinTempDay]    = useState('');
  const [maxTempDay,    setMaxTempDay]    = useState('');
  const [minTempNight,  setMinTempNight]  = useState('');
  const [maxTempNight,  setMaxTempNight]  = useState('');

  const [useSeasonal,   setUseSeasonal]   = useState(false);
  const [months,        setMonths]        = useState<number[]>([]);

  // ── Конфликт #4: scope условий для многодневных задач ──────
  const [conditionScope, setConditionScope] = useState<'perDay' | 'whole'>('perDay');

  // ── Завершение ─────────────────────────────────────────────
  const [endMode,  setEndMode]  = useState<'never' | 'after' | 'date'>('never');
  const [endAfter, setEndAfter] = useState(10);
  const [endDate,  setEndDate]  = useState('');

  // ── Если включён multiDay — заблокировать cyclic / dependency ──
  useEffect(() => {
    if (multiDay && mode !== 'interval' && mode !== 'adaptive') setMode('interval');
  }, [multiDay, mode]);

  // ── При multiDay подтягиваем every до безопасного минимума ──
  useEffect(() => {
    if (multiDay && mode === 'interval' && every < currentMinEvery) {
      setEvery(currentMinEvery);
    }
  }, [multiDay, mode, unit, currentMinEvery, every]);

  // ── Инициализация из initial ───────────────────────────────
  useEffect(() => {
    if (!initial) return;

    if (initial.dependencyDays != null && !multiDay) {
      setMode('dependency');
      setDependencyDays(initial.dependencyDays);
    } else if (initial.cyclicPattern?.length && !multiDay) {
      setMode('cyclic');
      setCyclicPattern(initial.cyclicPattern);
    } else {
      setMode('interval');
      setEvery(initial.every ?? 1);
      setUnit(initial.unit ?? 'day');
      setWeekdays(initial.weekdays ?? [startDow]);
      setSkipWeekends(initial.skipWeekends ?? false);
    }

    if (initial.months?.length) {
      setUseSeasonal(true);
      setMonths(initial.months);
    }

    if (initial.conditionScope === 'whole') setConditionScope('whole');

    if (initial.holidaySettings) {
      setUseHolidays(true);
      setSkipHolidays(initial.holidaySettings.skipHolidays ?? true);
      setOnlyOnHolidays(initial.holidaySettings.onlyOnHolidays ?? false);
    }

    if (initial.weatherCondition) {
      const wc = initial.weatherCondition;
      setUseWeather(true);
      setSkipRain(wc.skipRain ?? false);
      setSkipSnow(wc.skipSnow ?? false);
      setSkipStorm(wc.skipStorm ?? false);
      setSkipFog(wc.skipFog ?? false);
      setSkipCloudy(wc.skipCloudy ?? false);
      setRequireClear(wc.requireClear ?? false);
      setMinTempDay(wc.minTempDay != null ? String(wc.minTempDay) : '');
      setMaxTempDay(wc.maxTempDay != null ? String(wc.maxTempDay) : '');
      setMinTempNight(wc.minTempNight != null ? String(wc.minTempNight) : '');
      setMaxTempNight(wc.maxTempNight != null ? String(wc.maxTempNight) : '');
    }

    if (initial.endAfter) {
      setEndMode('after');
      setEndAfter(initial.endAfter);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

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

  // ── Сохранение ─────────────────────────────────────────────
  const handleSave = () => {
    const cfg: RepeatConfig = {};

    if (mode === 'dependency') {
      cfg.dependencyDays = Math.max(1, dependencyDays);
    } else if (mode === 'cyclic') {
      cfg.cyclicPattern = cyclicPattern.filter(s => s.active > 0 || s.rest > 0);
      if (!cfg.cyclicPattern.length) cfg.cyclicPattern = [{ active: 1, rest: 0 }];
    } else {
      cfg.every = every;
      cfg.unit  = unit;
      if (unit === 'week' && weekdays.length > 0 && !multiDay) cfg.weekdays = weekdays;
      if (skipWeekends && unit !== 'week' && !multiDay) cfg.skipWeekends = true;
    }

    if (endMode === 'after' && endAfter > 0) cfg.endAfter = endAfter;

    if (useSeasonal && months.length > 0 && months.length < 12) {
      cfg.months = [...months].sort((a, b) => a - b);
    }

    if (multiDay && conditionScope === 'whole') {
      cfg.conditionScope = 'whole';
    }

    if (useHolidays) {
      const hs: HolidaySettings = {};
      if (onlyOnHolidays) hs.onlyOnHolidays = true;
      else if (skipHolidays) hs.skipHolidays = true;
      if (Object.keys(hs).length) cfg.holidaySettings = hs;
    }

    if (useWeather) {
      const wc: WeatherCondition = {};
      if (skipRain)     wc.skipRain     = true;
      if (skipSnow)     wc.skipSnow     = true;
      if (skipStorm)    wc.skipStorm    = true;
      if (skipFog)      wc.skipFog      = true;
      if (skipCloudy)   wc.skipCloudy   = true;
      if (requireClear) wc.requireClear = true;
      if (minTempDay.trim())   wc.minTempDay   = Number(minTempDay);
      if (maxTempDay.trim())   wc.maxTempDay   = Number(maxTempDay);
      if (minTempNight.trim()) wc.minTempNight = Number(minTempNight);
      if (maxTempNight.trim()) wc.maxTempNight = Number(maxTempNight);
      if (Object.keys(wc).length) cfg.weatherCondition = wc;
    }

    const until = endMode === 'date' && endDate ? endDate : undefined;
    onSave(cfg, until);
  };

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

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={styles.modal} onMouseDown={e => e.stopPropagation()}>

        {/* Header */}
        <div className={styles.header}>
          <h3 className={styles.title}>Настройка повтора</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>

          {/* ── Секция: Расписание ── */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Расписание</div>

            {/* Переключатель режима */}
            <div className={styles.modeTabs}>
              <button
                type="button"
                className={`${styles.modeTab} ${mode === 'interval' ? styles.modeTabActive : ''}`}
                onClick={() => setMode('interval')}
              >
                По интервалу
              </button>
              <button
                type="button"
                className={`${styles.modeTab} ${mode === 'cyclic' ? styles.modeTabActive : ''} ${multiDay ? styles.modeTabDisabled : ''}`}
                onClick={() => !multiDay && setMode('cyclic')}
                disabled={multiDay}
                title={multiDay ? 'Недоступно для многодневных задач' : ''}
              >
                Циклический
              </button>
              <button
                type="button"
                className={`${styles.modeTab} ${mode === 'dependency' ? styles.modeTabActive : ''} ${multiDay ? styles.modeTabDisabled : ''}`}
                onClick={() => !multiDay && setMode('dependency')}
                disabled={multiDay}
                title={multiDay ? 'Недоступно для многодневных задач' : ''}
              >
                После выполнения
              </button>
              <button
                type="button"
                className={`${styles.modeTab} ${mode === 'adaptive' ? styles.modeTabActive : ''}`}
                onClick={() => setMode('adaptive')}
                title="Адаптивный режим — в разработке"
              >
                Адаптивный <span className={styles.modeTabBadge}>скоро</span>
              </button>
            </div>

            {multiDay && (
              <div className={styles.warnBanner}>
                Многодневный режим: доступен только интервальный повтор.
                Циклический и «после выполнения» работают с одиночными задачами.
              </div>
            )}

            {/* ── Интервальный ── */}
            {mode === 'interval' && (
              <div className={styles.intervalBlock}>
                <div className={styles.everyRow}>
                  <span className={styles.everyPrefix}>Каждые</span>
                  <input
                    className={styles.everyInput}
                    type="number"
                    min={currentMinEvery}
                    max={365}
                    value={every}
                    onChange={e => setEvery(Math.max(currentMinEvery, parseInt(e.target.value) || currentMinEvery))}
                    title={multiDay && currentMinEvery > 1 ? `Минимум ${currentMinEvery} — чтобы вхождения не накладывались на длительность задачи` : ''}
                  />
                  <div className={styles.unitBtns}>
                    {UNIT_OPTS.map(u => (
                      <button
                        key={u.v}
                        type="button"
                        className={`${styles.unitBtn} ${unit === u.v ? styles.unitBtnActive : ''}`}
                        onClick={() => {
                          setUnit(u.v);
                          // При смене единицы подтягиваем every до её минимума
                          const m = minEveryFor(u.v);
                          if (every < m) setEvery(m);
                        }}
                      >
                        {unitLabel(u.v, every)}
                      </button>
                    ))}
                  </div>
                </div>
                {multiDay && currentMinEvery > 1 && (
                  <div className={styles.minEveryHint}>
                    Минимум для многодневной задачи — {currentMinEvery} {unitLabel(unit, currentMinEvery)}
                  </div>
                )}

                {unit === 'week' && !multiDay && (
                  <div className={styles.wdRow}>
                    {WEEKDAYS.map(({ v, s }) => (
                      <button
                        key={v}
                        type="button"
                        className={`${styles.wdBtn} ${weekdays.includes(v) ? styles.wdBtnActive : ''}`}
                        onClick={() => toggleWeekday(v)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {unit !== 'week' && (
                  <label className={styles.checkRow}>
                    <input type="checkbox" checked={skipWeekends} onChange={e => setSkipWeekends(e.target.checked)} />
                    Пропускать субботу и воскресенье
                  </label>
                )}
              </div>
            )}

            {/* ── Цикличный ── */}
            {mode === 'cyclic' && !multiDay && (
              <div className={styles.cyclicBlock}>
                <div className={styles.cyclicHint}>
                  Задайте паттерн: сколько дней задача активна, затем сколько дней отдыха — и так по кругу.
                </div>
                <div className={styles.cyclicRows}>
                  {cyclicPattern.map((seg, idx) => (
                    <div key={idx} className={styles.cyclicRow}>
                      <span className={styles.cyclicIndex}>{idx + 1}</span>
                      <div className={styles.cyclicField}>
                        <input
                          className={styles.cyclicInput}
                          type="number"
                          min={0}
                          max={365}
                          value={seg.active}
                          onChange={e => updateCyclic(idx, 'active', parseInt(e.target.value) || 0)}
                        />
                        <span className={styles.cyclicFieldLabel}>дн. задач</span>
                      </div>
                      <span className={styles.cyclicArrow}>→</span>
                      <div className={styles.cyclicField}>
                        <input
                          className={styles.cyclicInput}
                          type="number"
                          min={0}
                          max={365}
                          value={seg.rest}
                          onChange={e => updateCyclic(idx, 'rest', parseInt(e.target.value) || 0)}
                        />
                        <span className={styles.cyclicFieldLabel}>дн. отдыха</span>
                      </div>
                      <button
                        type="button"
                        className={styles.cyclicRemoveBtn}
                        onClick={() => removeCyclicSegment(idx)}
                        disabled={cyclicPattern.length <= 1}
                        title="Удалить период"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className={styles.cyclicAddBtn} onClick={addCyclicSegment}>
                  + Добавить период
                </button>
                {cyclicPreview && (
                  <div className={styles.cyclicPreview}>{cyclicPreview}</div>
                )}
              </div>
            )}

            {/* ── Адаптивный (заглушка, недоступна) ── */}
            {mode === 'adaptive' && (
              <div className={styles.adaptiveBlock}>
                <div className={styles.adaptiveBadgeRow}>
                  <span className={styles.adaptiveBadge}>В разработке</span>
                </div>
                <div className={styles.cyclicHint}>
                  Система будет анализировать, в какие дни недели и время вы обычно
                  выполняете задачу, и сама подстроит расписание под ваши реальные
                  привычки. Появится в следующем обновлении.
                </div>
              </div>
            )}

            {/* ── После выполнения ── */}
            {mode === 'dependency' && !multiDay && (
              <div className={styles.depBlock}>
                <div className={styles.depHint}>
                  Задача появится снова через указанное число дней <b>после её выполнения</b>.
                  Если не выполнена — будет висеть до выполнения.
                </div>
                <div className={styles.depRow}>
                  <span className={styles.depLabel}>Через</span>
                  <input
                    className={styles.depInput}
                    type="number"
                    min={1}
                    max={365}
                    value={dependencyDays}
                    onChange={e => setDependencyDays(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                  <span className={styles.depLabel}>{unitLabel('day', dependencyDays)} после выполнения</span>
                </div>
              </div>
            )}
          </div>

          {/* ── Секция: Условия ── */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Условия</div>

            {/* Conflict #4: scope для многодневных */}
            {multiDay && (
              <div className={styles.scopeBlock}>
                <div className={styles.scopeLabel}>Применять условия к:</div>
                <div className={styles.scopeOpts}>
                  <label className={styles.scopeOpt}>
                    <input
                      type="radio"
                      name="condScope"
                      checked={conditionScope === 'perDay'}
                      onChange={() => setConditionScope('perDay')}
                    />
                    каждому дню (с пропусками)
                  </label>
                  <label className={styles.scopeOpt}>
                    <input
                      type="radio"
                      name="condScope"
                      checked={conditionScope === 'whole'}
                      onChange={() => setConditionScope('whole')}
                    />
                    всему блоку (без пропусков)
                  </label>
                </div>
              </div>
            )}

            {/* Сезонность */}
            <div className={styles.condBlock}>
              <label className={styles.condToggle}>
                <input
                  type="checkbox"
                  checked={useSeasonal}
                  onChange={e => setUseSeasonal(e.target.checked)}
                />
                <span className={styles.condToggleLabel}>Сезонность (только в выбранные месяцы)</span>
              </label>
              {useSeasonal && (
                <div className={styles.condOptions}>
                  <div className={styles.monthsGrid}>
                    {MONTHS_SHORT.map((m, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`${styles.monthChip} ${months.includes(i + 1) ? styles.monthChipActive : ''}`}
                        onClick={() => toggleMonth(i + 1)}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <div className={styles.seasonRow}>
                    {SEASONS.map(s => (
                      <button
                        key={s.label}
                        type="button"
                        className={styles.seasonBtn}
                        onClick={() => setSeasonMonths(s.months)}
                      >
                        {s.label}
                      </button>
                    ))}
                    <button type="button" className={styles.seasonClearBtn} onClick={clearMonths}>
                      Очистить
                    </button>
                  </div>
                  {months.length > 0 && months.length < 12 && (
                    <div className={styles.condNote}>
                      Активна {months.length === 1 ? 'в' : 'в'}{' '}
                      {months.map(m => MONTHS_SHORT[m - 1]).join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Праздники */}
            <div className={styles.condBlock}>
              <label className={styles.condToggle}>
                <input
                  type="checkbox"
                  checked={useHolidays}
                  onChange={e => setUseHolidays(e.target.checked)}
                />
                <span className={styles.condToggleLabel}>Учитывать праздники</span>
              </label>
              {useHolidays && (
                <div className={styles.condOptions}>
                  <label className={styles.radioRow}>
                    <input
                      type="radio"
                      name="holidayMode"
                      checked={!onlyOnHolidays}
                      onChange={() => { setSkipHolidays(true); setOnlyOnHolidays(false); }}
                    />
                    Пропускать государственные праздники
                  </label>
                  <label className={styles.radioRow}>
                    <input
                      type="radio"
                      name="holidayMode"
                      checked={onlyOnHolidays}
                      onChange={() => { setOnlyOnHolidays(true); setSkipHolidays(false); }}
                    />
                    Только в праздничные дни
                  </label>
                </div>
              )}
            </div>

            {/* Погода */}
            <div className={styles.condBlock}>
              <label className={styles.condToggle}>
                <input
                  type="checkbox"
                  checked={useWeather}
                  onChange={e => setUseWeather(e.target.checked)}
                />
                <span className={styles.condToggleLabel}>Учитывать погоду</span>
              </label>
              {useWeather && (
                <div className={styles.condOptions}>
                  <div className={styles.weatherNote}>
                    Прогноз доступен до 16 дней вперёд. На более поздние даты задача будет показана.
                  </div>
                  <div className={styles.condSubLabel}>Пропускать при:</div>
                  <div className={styles.weatherSkipRow}>
                    <label className={styles.weatherChip}>
                      <input type="checkbox" checked={skipRain} onChange={e => setSkipRain(e.target.checked)} />
                      🌧 Дождь
                    </label>
                    <label className={styles.weatherChip}>
                      <input type="checkbox" checked={skipSnow} onChange={e => setSkipSnow(e.target.checked)} />
                      🌨 Снег
                    </label>
                    <label className={styles.weatherChip}>
                      <input type="checkbox" checked={skipStorm} onChange={e => setSkipStorm(e.target.checked)} />
                      ⛈ Гроза
                    </label>
                    <label className={styles.weatherChip}>
                      <input type="checkbox" checked={skipFog} onChange={e => setSkipFog(e.target.checked)} />
                      🌫 Туман
                    </label>
                    <label className={styles.weatherChip}>
                      <input type="checkbox" checked={skipCloudy} onChange={e => setSkipCloudy(e.target.checked)} />
                      ☁️ Пасмурно
                    </label>
                  </div>
                  <label className={styles.checkRow}>
                    <input type="checkbox" checked={requireClear} onChange={e => setRequireClear(e.target.checked)} />
                    Только в ясную погоду
                  </label>
                  <div className={styles.condSubLabel}>Температура днём (°C):</div>
                  <div className={styles.tempRow}>
                    <span className={styles.tempLabel}>от</span>
                    <input
                      className={styles.tempInput}
                      type="number"
                      placeholder="—"
                      value={minTempDay}
                      onChange={e => setMinTempDay(e.target.value)}
                    />
                    <span className={styles.tempLabel}>до</span>
                    <input
                      className={styles.tempInput}
                      type="number"
                      placeholder="—"
                      value={maxTempDay}
                      onChange={e => setMaxTempDay(e.target.value)}
                    />
                    <span className={styles.tempLabel}>°C</span>
                  </div>
                  <div className={styles.condSubLabel}>Температура ночью (°C):</div>
                  <div className={styles.tempRow}>
                    <span className={styles.tempLabel}>от</span>
                    <input
                      className={styles.tempInput}
                      type="number"
                      placeholder="—"
                      value={minTempNight}
                      onChange={e => setMinTempNight(e.target.value)}
                    />
                    <span className={styles.tempLabel}>до</span>
                    <input
                      className={styles.tempInput}
                      type="number"
                      placeholder="—"
                      value={maxTempNight}
                      onChange={e => setMaxTempNight(e.target.value)}
                    />
                    <span className={styles.tempLabel}>°C</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Секция: Завершение ── */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Завершение</div>
            <div className={styles.endOpts}>
              <label className={styles.radioRow}>
                <input type="radio" name="endMode" checked={endMode === 'never'} onChange={() => setEndMode('never')} />
                Никогда
              </label>
              <label className={styles.radioRow}>
                <input type="radio" name="endMode" checked={endMode === 'after'} onChange={() => setEndMode('after')} />
                После
                <input
                  className={styles.endAfterInput}
                  type="number"
                  min={1}
                  max={9999}
                  value={endAfter}
                  disabled={endMode !== 'after'}
                  onChange={e => setEndAfter(Math.max(1, parseInt(e.target.value) || 1))}
                  onClick={() => setEndMode('after')}
                />
                повторений
              </label>
              <label className={styles.radioRow}>
                <input type="radio" name="endMode" checked={endMode === 'date'} onChange={() => setEndMode('date')} />
                До даты
              </label>
              {endMode === 'date' && (
                <MiniCalendar
                  value={endDate}
                  minDate={minRepeatUntil}
                  onChange={setEndDate}
                />
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>Отмена</button>
          <button
            type="button"
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={mode === 'adaptive'}
            title={mode === 'adaptive' ? 'Адаптивный режим ещё в разработке' : ''}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
