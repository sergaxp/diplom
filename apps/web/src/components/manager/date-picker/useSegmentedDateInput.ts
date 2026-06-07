'use client';

import { Dispatch, SetStateAction, useRef, useState } from 'react';
import {
  buildIso, fromStr, today0,
  normalizeDaySegment, normalizeMonthSegment, normalizeYearSegment,
} from './logic';

type CalTarget = null | 'start' | 'end';
type Seg = 'day' | 'mon' | 'year';

interface UseSegmentedDateInputArgs {
  date: string;
  endDate: string;
  now: Date;
  calTarget: CalTarget;
  setCalTarget: (t: CalTarget) => void;
  setCalMonth: Dispatch<SetStateAction<number>>;
  setCalYear: Dispatch<SetStateAction<number>>;
  setHoverDate: (d: string | null) => void;
  onChangeDate: (d: string) => void;
  onChangeEndDate: (d: string) => void;
}

/** Сегментный ввод даты (ДД.ММ.ГГГГ): состояние полей, переходы фокуса, навигация календаря, авто-подтверждение. */
export function useSegmentedDateInput({
  date, endDate, now, calTarget, setCalTarget,
  setCalMonth, setCalYear, setHoverDate, onChangeDate, onChangeEndDate,
}: UseSegmentedDateInputArgs) {
  const [editDay,  setEditDay]  = useState('');
  const [editMon,  setEditMon]  = useState('');
  const [editYear, setEditYear] = useState('');

  const dayRef  = useRef<HTMLInputElement>(null);
  const monRef  = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  // ── Открыть редактор для поля ─────────────────────────────────
  const openEdit = (which: 'start' | 'end') => {
    if (calTarget === which) { setCalTarget(null); return; }

    const val = which === 'start' ? date : (endDate || '');
    const d   = val ? fromStr(val) : now;

    setCalTarget(which);
    // Предзаполнение сегментов текущей датой поля
    if (val) {
      setEditDay(String(d.getDate()).padStart(2,'0'));
      setEditMon(String(d.getMonth()+1).padStart(2,'0'));
      setEditYear(String(d.getFullYear()));
    } else {
      setEditDay(''); setEditMon(''); setEditYear('');
    }
    setCalYear(d.getFullYear()); setCalMonth(d.getMonth());
    setHoverDate(null);
    setTimeout(() => { dayRef.current?.focus(); dayRef.current?.select(); }, 0);
  };

  // ── Переход к следующему/предыдущему сегменту ────────────────
  const focusNext = (from: 'day' | 'mon') => {
    if (from === 'day') { monRef.current?.focus(); setTimeout(()=>monRef.current?.select(),0); }
    else { yearRef.current?.focus(); setTimeout(()=>yearRef.current?.select(),0); }
  };
  const focusPrev = (from: 'mon' | 'year') => {
    if (from === 'mon') { dayRef.current?.focus(); setTimeout(()=>dayRef.current?.select(),0); }
    else { monRef.current?.focus(); setTimeout(()=>monRef.current?.select(),0); }
  };

  // ── Навигация календаря по введённым сегментам ───────────────
  // Месяц навигирует независимо от года; год навигирует только при 4 цифрах
  const tryNavigateCal = (mon: string, year: string) => {
    const m = parseInt(mon);
    if (mon.length === 2 && m >= 1 && m <= 12) setCalMonth(m - 1);
    const y = parseInt(year);
    if (year.length === 4 && y >= 1000) setCalYear(y);
  };

  // Авто-подтверждение при полном вводе
  const tryAutoConfirm = (day: string, mon: string, year: string) => {
    if (year.length !== 4) return;
    const iso = buildIso(day.padStart(2,'0'), mon.padStart(2,'0'), year);
    if (!iso || !calTarget) return;
    if (calTarget === 'end' && date && iso < date) return;
    if (calTarget === 'start') { onChangeDate(iso); if (endDate && iso >= endDate) onChangeEndDate(''); }
    else onChangeEndDate(iso);
    setCalTarget(null);
  };

  // ── Ввод в сегменты ───────────────────────────────────────────
  const handleDayChange = (raw: string) => {
    const { value, complete } = normalizeDaySegment(raw);
    setEditDay(value);
    if (complete) focusNext('day');
  };

  const handleMonChange = (raw: string) => {
    const { value, complete } = normalizeMonthSegment(raw);
    setEditMon(value);
    tryNavigateCal(value, editYear);
    if (complete) focusNext('mon');
  };

  const handleYearChange = (raw: string) => {
    const val = normalizeYearSegment(raw);
    setEditYear(val);
    tryNavigateCal(editMon, val);
    tryAutoConfirm(editDay, editMon, val);
  };

  // ── Space: заполнить из выбранной даты или авто-дополнить ─────
  const handleSpace = (seg: Seg) => {
    const ref = calTarget === 'end' && endDate ? fromStr(endDate)
              : date ? fromStr(date) : today0();

    if (seg === 'day') {
      const newVal = editDay === '' ? String(ref.getDate()).padStart(2,'0')
                   : editDay.length === 1 ? editDay.padStart(2,'0')
                   : editDay;
      const clamped = Math.min(Math.max(parseInt(newVal)||1,1),31);
      setEditDay(String(clamped).padStart(2,'0'));
      focusNext('day');
    } else if (seg === 'mon') {
      const newVal = editMon === '' ? String(ref.getMonth()+1).padStart(2,'0')
                   : editMon.length === 1 ? editMon.padStart(2,'0')
                   : editMon;
      const clamped = Math.min(Math.max(parseInt(newVal)||1,1),12);
      setEditMon(String(clamped).padStart(2,'0'));
      focusNext('mon');
    } else {
      // Year: пробел → подставить текущий год и сразу авто-подтвердить
      const yr = editYear.length < 4 ? String(new Date().getFullYear()) : editYear;
      setEditYear(yr);
      const dayVal = editDay || String(ref.getDate()).padStart(2,'0');
      const monVal = editMon || String(ref.getMonth()+1).padStart(2,'0');
      tryAutoConfirm(dayVal, monVal, yr);
    }
  };

  // ── onKeyDown для каждого сегмента ────────────────────────────
  const handleSegKeyDown = (seg: Seg, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter')  { e.preventDefault(); setCalTarget(null); return; }
    if (e.key === 'Escape') { setCalTarget(null); return; }

    if (e.key === ' ') { e.preventDefault(); handleSpace(seg); return; }

    // Точка или запятая → переход к следующему сегменту
    if (e.key === '.' || e.key === ',') {
      e.preventDefault();
      if (seg === 'day') {
        if (editDay.length === 1) setEditDay(editDay.padStart(2,'0'));
        focusNext('day');
      } else if (seg === 'mon') {
        if (editMon.length === 1) setEditMon(editMon.padStart(2,'0'));
        focusNext('mon');
      }
      return;
    }

    // Backspace в начале пустого поля → возврат к предыдущему
    if (e.key === 'Backspace') {
      const cur = e.currentTarget;
      if (cur.selectionStart === 0 && cur.selectionEnd === 0) {
        if (seg === 'mon')  { e.preventDefault(); focusPrev('mon'); }
        if (seg === 'year') { e.preventDefault(); focusPrev('year'); }
      }
      return;
    }

    // Стрелки влево/вправо – переключение между сегментами на краях
    if (e.key === 'ArrowLeft' && e.currentTarget.selectionStart === 0) {
      e.preventDefault();
      if (seg === 'mon')  focusPrev('mon');
      if (seg === 'year') focusPrev('year');
    }
    if (e.key === 'ArrowRight' && e.currentTarget.selectionStart === e.currentTarget.value.length) {
      e.preventDefault();
      if (seg === 'day') focusNext('day');
      if (seg === 'mon') focusNext('mon');
    }
  };

  return {
    editDay, editMon, editYear,
    dayRef, monRef, yearRef,
    openEdit,
    handleDayChange, handleMonChange, handleYearChange,
    handleSegKeyDown,
  };
}
