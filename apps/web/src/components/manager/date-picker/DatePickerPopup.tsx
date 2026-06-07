'use client';

import { useMemo, useState } from 'react';
import { TaskRepeat, TaskType, RepeatConfig, toDateStr } from '../../../lib/tasks';
import { useHolidays, HolidayMap, HolidayEntry } from '../../../lib/holidays';
import { useAuthStore } from '../../../store/authStore';
import {
  WD_PREP,
  fromStr, today0, addDays, getNextMonday, getNextSaturday, nearestWeekday,
  buildGrid, buildIso,
  getDayCount, rangeIsMonthOrMore, rangeIsYearOrMore,
  getRepeatLabel, buildRepeatOptions,
} from './logic';
import { useSegmentedDateInput } from './useSegmentedDateInput';
import { useViewportPopover } from './useViewportPopover';
import { ShortcutsBar } from './ShortcutsBar';
import { DateSegmentInput } from './DateSegmentInput';
import { MiniCalendarGrid } from './MiniCalendarGrid';
import { RepeatSection } from './RepeatSection';
import styles from './DatePickerPopup.module.scss';

// ── Props ─────────────────────────────────────────────────────

interface Props {
  triggerRef: React.RefObject<HTMLElement | null>;
  date: string; endDate: string; multiDay: boolean;
  repeat: TaskRepeat; repeatUntil: string; hasRepeatUntil: boolean;
  repeatConfig: RepeatConfig | null | undefined; taskType: TaskType;
  onChangeDate:           (d: string) => void;
  onChangeEndDate:        (d: string) => void;
  onChangeMultiDay:       (v: boolean) => void;
  onChangeRepeat:         (r: TaskRepeat) => void;
  onChangeRepeatUntil:    (d: string) => void;
  onChangeHasRepeatUntil: (v: boolean) => void;
  onChangeRepeatConfig:   (c: RepeatConfig | null) => void;
  onOpenRepeatConfig:     () => void;
  onClose:                () => void;
}

// ── Component ─────────────────────────────────────────────────

export function DatePickerPopup({
  triggerRef, date, endDate, multiDay, repeat, repeatUntil, hasRepeatUntil,
  repeatConfig, taskType, onChangeDate, onChangeEndDate, onChangeMultiDay,
  onChangeRepeat, onChangeRepeatUntil, onChangeHasRepeatUntil, onChangeRepeatConfig,
  onOpenRepeatConfig, onClose,
}: Props) {
  const now  = today0();
  const selD = fromStr(date);

  const [calYear,    setCalYear]    = useState(selD.getFullYear());
  const [calMonth,   setCalMonth]   = useState(selD.getMonth());
  const [calTarget,  setCalTarget]  = useState<null | 'start' | 'end'>(null);
  const [hoverDate,  setHoverDate]  = useState<string | null>(null);
  const [repeatOpen, setRepeatOpen] = useState(false);

  const showHolidays = useAuthStore(s => s.user?.showHolidays !== false);
  const { data: holData } = useHolidays(calYear, showHolidays);
  const holidayMap = useMemo(() => {
    const m: HolidayMap = new Map<string, HolidayEntry>();
    for (const e of holData ?? []) m.set(e.date, e);
    return m;
  }, [holData]);

  const { popupRef, pos } = useViewportPopover(triggerRef);

  const {
    editDay, editMon, editYear, dayRef, monRef, yearRef,
    openEdit, handleDayChange, handleMonChange, handleYearChange, handleSegKeyDown,
  } = useSegmentedDateInput({
    date, endDate, now, calTarget, setCalTarget,
    setCalMonth, setCalYear, setHoverDate, onChangeDate, onChangeEndDate,
  });

  // ── Шорткаты ─────────────────────────────────────────────────
  const sc = [
    { label: 'Сегодня',        d: now },
    { label: 'Завтра',         d: addDays(now,1) },
    { label: 'След. неделя',   d: getNextMonday(now) },
    { label: 'Ближ. выходные', d: getNextSaturday(now) },
  ];
  const selectDate = (d: Date) => { onChangeDate(toDateStr(d)); setCalTarget(null); };

  // ── Повтор ───────────────────────────────────────────────────
  const dow = selD.getDay(), dayN = selD.getDate(), monIdx = selD.getMonth();

  // Количество дней в выбранном диапазоне
  const dayCount = multiDay && endDate ? getDayCount(date, endDate) : 0;

  // Диапазон ≥ 1 месяц / ≥ 1 год (учитывают разную длину месяцев и високосные годы)
  const isRangeMonthOrMore = multiDay && !!endDate && rangeIsMonthOrMore(date, endDate);
  const isRangeYearOrMore  = multiDay && !!endDate && rangeIsYearOrMore(date, endDate);

  // Значения для отображения в опциях повтора.
  // При редактировании начальной даты обновляются в реальном времени;
  // при редактировании конечной – остаются на начальной дате.
  const rptDay = (calTarget === 'start' && editDay.length >= 1)
    ? Math.max(1, Math.min(31, parseInt(editDay) || dayN))
    : dayN;
  const rptMon = (calTarget === 'start' && editMon.length === 2)
    ? Math.max(0, Math.min(11, (parseInt(editMon) || 1) - 1))
    : monIdx;
  // rptDow вычисляем без зависимости от previewDate (объявлен ниже)
  const rptDow = (() => {
    if (calTarget !== 'start') return dow;
    const dd = editDay.padStart(2, '0');
    const mm = (editMon.length === 2 ? editMon : String(calMonth + 1)).padStart(2, '0');
    const yy = editYear.length === 4 ? editYear : String(calYear);
    const iso = buildIso(dd, mm, yy);
    return iso ? fromStr(iso).getDay() : dow;
  })();
  const [rptWpre, rptWday] = WD_PREP[rptDow];

  // Варианты повтора (с учётом фильтрации в мультидневном режиме)
  const repeatOpts = buildRepeatOptions({
    multiDay, dayCount,
    rangeIsMonthOrMore: isRangeMonthOrMore,
    rangeIsYearOrMore: isRangeYearOrMore,
    rptDow, rptWpre, rptWday, rptDay, rptMon,
  });

  const handleRepeatSelect = (value: TaskRepeat) => {
    if (value === repeat) { onChangeRepeat('none'); onChangeHasRepeatUntil(false); onChangeRepeatUntil(''); onChangeRepeatConfig(null); }
    else {
      if (value === 'weekdays' && (dow===0||dow===6)) onChangeDate(toDateStr(nearestWeekday(addDays(selD,1))));
      onChangeRepeat(value); onChangeRepeatConfig(null);
    }
    setRepeatOpen(false);
  };
  const clearRepeat = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChangeRepeat('none'); onChangeHasRepeatUntil(false); onChangeRepeatUntil(''); onChangeRepeatConfig(null);
  };
  const repeatLabel = getRepeatLabel({ repeat, multiDay, repeatConfig, rptDow, rptWpre, rptWday, rptDay, rptMon });

  // ── Предварительная дата (подсветка в календаре при вводе) ────
  const previewDate = useMemo(() => {
    if (!calTarget) return null;
    const dd = (editDay || '01').padStart(2,'0');
    const mm = (editMon || String(calMonth + 1)).padStart(2,'0');
    const yy = editYear.length === 4 ? editYear : String(calYear);
    return buildIso(dd, mm, yy);
  }, [calTarget, editDay, editMon, editYear, calMonth, calYear]);

  // ── Календарь ─────────────────────────────────────────────────
  const grid = buildGrid(calYear, calMonth);
  const todayStr = toDateStr(now), selStr = date, endStr = endDate||'';

  const handleDayClick = (d: Date) => {
    const s = toDateStr(d);
    // Конечная дата не может быть раньше начальной (если начальная задана)
    if (calTarget === 'end' && date && s < date) return;
    if (calTarget === 'end') { onChangeEndDate(s); }
    else { onChangeDate(s); if (endDate && s >= endDate) onChangeEndDate(''); }
    setCalTarget(null); setHoverDate(null);
  };

  if (!pos) return null;

  return (
    <>
      <div className={styles.backdrop} onMouseDown={onClose} />
      <div ref={popupRef} className={styles.popup} style={{ top: pos.top, left: pos.left }} onMouseDown={e=>e.stopPropagation()}>

        {/* ── 1: Shortcuts ── */}
        <ShortcutsBar items={sc} now={now} date={date} onSelect={selectDate} />

        <div className={styles.divider} />

        {/* ── 2: Date inputs + calendar ── */}
        <div className={styles.dateSection}>
          <div className={styles.dateRow}>
            {taskType !== 'mandatory' && multiDay ? (
              // Оба поля в общей обёртке – гарантирует равную ширину всегда
              <>
                <div className={styles.datePillPair}>
                  <DateSegmentInput which="start" fixed value={date} isOpen={calTarget==='start'}
                    editDay={editDay} editMon={editMon} editYear={editYear}
                    dayRef={dayRef} monRef={monRef} yearRef={yearRef}
                    onOpen={openEdit} onDayChange={handleDayChange} onMonChange={handleMonChange}
                    onYearChange={handleYearChange} onSegKeyDown={handleSegKeyDown} />
                  <span className={styles.dateSep}>→</span>
                  <DateSegmentInput which="end" fixed value={endDate} isOpen={calTarget==='end'}
                    editDay={editDay} editMon={editMon} editYear={editYear}
                    dayRef={dayRef} monRef={monRef} yearRef={yearRef}
                    onOpen={openEdit} onDayChange={handleDayChange} onMonChange={handleMonChange}
                    onYearChange={handleYearChange} onSegKeyDown={handleSegKeyDown} />
                </div>
                <button type="button" className={styles.multiClear}
                  onMouseDown={e=>e.preventDefault()}
                  onClick={() => { onChangeMultiDay(false); onChangeEndDate(''); setCalTarget(null); }}
                  title="Убрать конечную дату">✕</button>
              </>
            ) : (
              // Одиночная дата: поле + всегда видимая кнопка «+ до»
              <>
                <DateSegmentInput which="start" value={date} isOpen={calTarget==='start'}
                  editDay={editDay} editMon={editMon} editYear={editYear}
                  dayRef={dayRef} monRef={monRef} yearRef={yearRef}
                  onOpen={openEdit} onDayChange={handleDayChange} onMonChange={handleMonChange}
                  onYearChange={handleYearChange} onSegKeyDown={handleSegKeyDown} />
                {taskType !== 'mandatory' && (
                  <button type="button" className={styles.multiAdd}
                    onClick={() => {
                      onChangeMultiDay(true);
                      // Если конечная дата пустая или раньше/равна начальной – ставим следующий день
                      if (!endDate || endDate <= date) {
                        onChangeEndDate(toDateStr(addDays(fromStr(date), 1)));
                      }
                      setCalTarget(null);
                    }}>+ до</button>
                )}
              </>
            )}
          </div>

          {calTarget !== null && (
            <MiniCalendarGrid
              calYear={calYear} calMonth={calMonth} setCalYear={setCalYear} setCalMonth={setCalMonth}
              now={now} grid={grid} holidayMap={holidayMap} multiDay={multiDay} calTarget={calTarget}
              date={date} selStr={selStr} endStr={endStr} todayStr={todayStr}
              hoverDate={hoverDate} setHoverDate={setHoverDate} previewDate={previewDate}
              onDayClick={handleDayClick}
            />
          )}
        </div>

        <div className={styles.divider} />

        {/* ── 3: Repeat ── */}
        <RepeatSection
          repeat={repeat} repeatLabel={repeatLabel} repeatOpts={repeatOpts}
          repeatOpen={repeatOpen} setRepeatOpen={setRepeatOpen}
          onSelect={handleRepeatSelect} onClear={clearRepeat} onOpenRepeatConfig={onOpenRepeatConfig}
          hasRepeatUntil={hasRepeatUntil} onChangeHasRepeatUntil={onChangeHasRepeatUntil}
          repeatUntil={repeatUntil} onChangeRepeatUntil={onChangeRepeatUntil}
          multiDay={multiDay} date={date} endDate={endDate}
        />

      </div>
    </>
  );
}
