'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { TaskRepeat, TaskType, RepeatConfig } from '../../lib/tasks';
import { useHolidays, getHolidayColor } from '../../lib/holidays';
import { useAuthStore } from '../../store/authStore';
import styles from './DatePickerPopup.module.scss';

// ── Helpers ───────────────────────────────────────────────────

const MONTH_NAME = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                    'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const MONTH_GEN  = ['января','февраля','марта','апреля','мая','июня',
                    'июля','августа','сентября','октября','ноября','декабря'];
const DAY_SHORT  = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];

const WD_PREP: [string, string][] = [
  ['в', 'воскресенье'], ['в', 'понедельник'], ['во', 'вторник'],
  ['в', 'среду'], ['в', 'четверг'], ['в', 'пятницу'], ['в', 'субботу'],
];

function toStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fromStr(s: string) { return new Date(s + 'T00:00:00'); }
function today0() { const d = new Date(); d.setHours(0,0,0,0); return d; }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(d.getDate()+n); return r; }
function getNextMonday(from: Date) { const dow = from.getDay(); return addDays(from, dow === 0 ? 1 : 8 - dow); }
function getNextSaturday(from: Date) { const dow = from.getDay(); const days = ((6-dow)+7)%7; return addDays(from, days === 0 ? 7 : days); }
function nearestWeekday(from: Date) { let d = new Date(from); while (d.getDay()===0||d.getDay()===6) d=addDays(d,1); return d; }

function scRight(d: Date, base: Date) {
  const diff = Math.round((d.getTime()-base.getTime())/86_400_000);
  const abbr = DAY_SHORT[d.getDay()];
  if (diff <= 1) return abbr;
  return `${abbr} ${d.getDate()} ${MONTH_GEN[d.getMonth()]}`;
}

export function getDateButtonLabel(s: string): string {
  const t = today0(); const d = fromStr(s);
  const diff = Math.round((d.getTime()-t.getTime())/86_400_000);
  if (diff === -1) return 'Вчера';
  if (diff ===  0) return 'Сегодня';
  if (diff ===  1) return 'Завтра';
  return `${d.getDate()} ${MONTH_GEN[d.getMonth()]}`;
}

function buildGrid(year: number, month: number): (Date|null)[][] {
  const firstDow = (new Date(year,month,1).getDay()+6)%7;
  const days = new Date(year,month+1,0).getDate();
  const rows: (Date|null)[][] = [];
  let row: (Date|null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= days; d++) {
    row.push(new Date(year,month,d));
    if (row.length === 7) { rows.push(row); row = []; }
  }
  if (row.length) { while (row.length < 7) row.push(null); rows.push(row); }
  return rows;
}

function fmtDisplay(s: string): string {
  const d = fromStr(s);
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
}

function buildIso(day: string, mon: string, year: string): string | null {
  const dd = parseInt(day)||0, mm = parseInt(mon)||0, yyyy = parseInt(year)||0;
  if (dd < 1 || dd > 31 || mm < 1 || mm > 12 || yyyy < 1000 || yyyy > 9999) return null;
  const d = new Date(yyyy, mm-1, dd);
  if (d.getMonth() !== mm-1) return null;
  return toStr(d);
}

/** Номер ISO-недели (пн = первый день) */
function getISOWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y.getTime()) / 86_400_000 + 1) / 7);
}

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

  // ── Три независимых сегмента ──────────────────────────────────
  const [editDay,  setEditDay]  = useState('');
  const [editMon,  setEditMon]  = useState('');
  const [editYear, setEditYear] = useState('');

  const dayRef  = useRef<HTMLInputElement>(null);
  const monRef  = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  const showHolidays = useAuthStore(s => s.user?.showHolidays !== false);
  const { data: holData } = useHolidays(calYear, showHolidays);
  const holidayMap = useMemo(() => {
    const m = new Map<string, { name: string; type: 'holiday'|'shortday'|'workday' }>();
    for (const e of holData ?? []) m.set(e.date, e);
    return m;
  }, [holData]);

  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useEffect(() => {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPos({ top: r.bottom+4, left: r.left });
    }
  }, [triggerRef]);

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

  // ── Переход к следующему сегменту ────────────────────────────
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

  // ── Ввод в сегмент дня ────────────────────────────────────────
  const handleDayChange = (raw: string) => {
    const digits = raw.replace(/\D/g,'');
    let val = digits.slice(0,2);
    if (val.length === 1 && parseInt(val[0]) > 3) val = '0' + val[0];
    val = val.slice(0,2);
    // Зажим 01–31 + авто-переход при любом 2-значном числе
    if (val.length === 2) {
      const n = parseInt(val);
      if (n < 1) val = '01';
      else if (n > 31) val = '31';
      setEditDay(val);
      focusNext('day');
    } else {
      setEditDay(val);
    }
  };

  const handleMonChange = (raw: string) => {
    const d = raw.replace(/\D/g,'');
    let val = d.slice(0,2);
    if (val.length === 1 && parseInt(val[0]) > 1) val = '0' + val[0];
    val = val.slice(0,2);
    // Зажим 01–12 + авто-переход при любом 2-значном числе
    if (val.length === 2) {
      const n = parseInt(val);
      if (n < 1) val = '01';
      else if (n > 12) val = '12';
    }
    setEditMon(val);
    tryNavigateCal(val, editYear);
    if (val.length === 2) focusNext('mon');
  };

  const handleYearChange = (raw: string) => {
    const val = raw.replace(/\D/g,'').slice(0,4);
    setEditYear(val);
    tryNavigateCal(editMon, val);
    tryAutoConfirm(editDay, editMon, val);
  };

  // ── Space: заполнить из выбранной даты или авто-дополнить ─────
  const handleSpace = (seg: 'day' | 'mon' | 'year') => {
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
  type Seg = 'day' | 'mon' | 'year';
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

    // Стрелки влево/вправо — переключение между сегментами на краях
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


  // ── Шорткаты ─────────────────────────────────────────────────
  const sc = [
    { label: 'Сегодня',        d: now },
    { label: 'Завтра',         d: addDays(now,1) },
    { label: 'След. неделя',   d: getNextMonday(now) },
    { label: 'Ближ. выходные', d: getNextSaturday(now) },
  ];
  const selectDate = (d: Date) => { onChangeDate(toStr(d)); setCalTarget(null); };

  // ── Повтор ───────────────────────────────────────────────────
  const dow = selD.getDay(), dayN = selD.getDate(), monIdx = selD.getMonth();

  // «с/со [день в родительном падеже]» для мультидневного режима
  const WD_WITH = [
    'с воскресенья', 'с понедельника', 'со вторника', 'со среды',
    'с четверга', 'с пятницы', 'с субботы',
  ];

  // Количество дней в выбранном диапазоне
  const dayCount = multiDay && endDate
    ? Math.round((fromStr(endDate).getTime() - fromStr(date).getTime()) / 86_400_000)
    : 0;

  // Диапазон ≥ 1 месяц (учитывает разную длину месяцев)
  const rangeIsMonthOrMore = (() => {
    if (!multiDay || !endDate) return false;
    const start = fromStr(date);
    const end   = fromStr(endDate);
    const oneMonthLater = new Date(start);
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
    return end >= oneMonthLater;
  })();

  // Диапазон ≥ 1 год (учитывает високосные годы)
  const rangeIsYearOrMore = (() => {
    if (!multiDay || !endDate) return false;
    const start = fromStr(date);
    const end   = fromStr(endDate);
    const oneYearLater = new Date(start);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    return end >= oneYearLater;
  })();

  // Значения для отображения в опциях повтора.
  // При редактировании начальной даты обновляются в реальном времени;
  // при редактировании конечной — остаются на начальной дате.
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

  // Все возможные варианты повтора
  const allRepeatOpts: { value: TaskRepeat; text: React.ReactNode }[] = [
    { value: 'daily',    text: 'Каждый день' },
    {
      value: 'weekly',
      text: multiDay
        ? <>{`Каждую неделю `}<span className={styles.repeatAccent}>{WD_WITH[rptDow]}</span></>
        : <>{`Каждую неделю `}<span className={styles.repeatAccent}>{`${rptWpre} ${rptWday}`}</span></>,
    },
    { value: 'weekdays', text: <>{`Каждый будний день `}<span className={styles.repeatAccent}>(Пн - Пт)</span></> },
    {
      value: 'monthly',
      text: multiDay
        ? <>{`С каждого `}<span className={styles.repeatAccent}>{`${rptDay}-го числа`}</span></>
        : <>{`Каждое `}<span className={styles.repeatAccent}>{`${rptDay} число`}</span></>,
    },
    {
      value: 'yearly',
      text: multiDay
        ? <>{`С каждого `}<span className={styles.repeatAccent}>{`${rptDay} ${MONTH_GEN[rptMon]}`}</span></>
        : <>{`Каждое `}<span className={styles.repeatAccent}>{`${rptDay} ${MONTH_GEN[rptMon]}`}</span></>,
    },
  ];

  // Фильтрация: в мультидневном режиме убираем варианты по условиям
  const repeatOpts = allRepeatOpts.filter(({ value }) => {
    if (!multiDay) return true;
    if (value === 'daily' || value === 'weekdays') return false;
    if (value === 'weekly'  && dayCount > 6)  return false;
    if (value === 'monthly' && rangeIsMonthOrMore) return false;
    if (value === 'yearly'  && rangeIsYearOrMore)  return false;
    return true;
  });

  const handleRepeatSelect = (value: TaskRepeat) => {
    if (value === repeat) { onChangeRepeat('none'); onChangeHasRepeatUntil(false); onChangeRepeatUntil(''); onChangeRepeatConfig(null); }
    else {
      if (value === 'weekdays' && (dow===0||dow===6)) onChangeDate(toStr(nearestWeekday(addDays(selD,1))));
      onChangeRepeat(value); onChangeRepeatConfig(null);
    }
    setRepeatOpen(false);
  };
  const clearRepeat = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChangeRepeat('none'); onChangeHasRepeatUntil(false); onChangeRepeatUntil(''); onChangeRepeatConfig(null);
  };
  const repeatLabel = (() => {
    if (repeat==='none') return '↻ Повтор';
    if (repeat==='daily') return '↻ Каждый день';
    if (repeat==='weekdays') return '↻ Каждый будний день';
    if (repeat==='weekly') return multiDay
      ? `↻ Кажд. нед. ${WD_WITH[rptDow]}`
      : `↻ Кажд. нед. ${rptWpre} ${rptWday}`;
    if (repeat==='monthly') return multiDay
      ? `↻ С кажд. ${rptDay}-го числа`
      : `↻ Каждое ${rptDay} число`;
    if (repeat==='yearly') return multiDay
      ? `↻ С кажд. ${rptDay} ${MONTH_GEN[rptMon]}`
      : `↻ Каждое ${rptDay} ${MONTH_GEN[rptMon]}`;
    if (repeat==='custom'&&repeatConfig) {
      if (repeatConfig.dependencyDays != null) return `↻ Через ${repeatConfig.dependencyDays} дн. после выполн.`;
      if (repeatConfig.cyclicPattern?.length) return `↻ Цикл ${repeatConfig.cyclicPattern.reduce((s,p)=>s+p.active+p.rest,0)} дней`;
      const u = {day:'дн',week:'нед',month:'мес',year:'лет'}[repeatConfig.unit ?? 'day'];
      const base = `↻ Каждые ${repeatConfig.every ?? 1} ${u}`;
      if (repeatConfig.months?.length && repeatConfig.months.length < 12) return `${base}, сезонно`;
      return base;
    }
    return '↻ Повтор';
  })();

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
  const todayStr = toStr(now), selStr = date, endStr = endDate||'';

  const getHoverRange = (): { from: string; to: string } | null => {
    if (!multiDay||!hoverDate) return null;
    if (calTarget==='end'   && hoverDate>selStr) return { from: selStr, to: hoverDate };
    if (calTarget==='start' && endStr && hoverDate<endStr) return { from: hoverDate, to: endStr };
    return null;
  };

  const prevMonth = () => { if (calMonth===0){setCalYear(y=>y-1);setCalMonth(11);}else setCalMonth(m=>m-1); };
  const nextMonth = () => { if (calMonth===11){setCalYear(y=>y+1);setCalMonth(0);}else setCalMonth(m=>m+1); };

  const handleDayClick = (d: Date) => {
    const s = toStr(d);
    // Конечная дата не может быть раньше начальной (если начальная задана)
    if (calTarget === 'end' && date && s < date) return;
    if (calTarget === 'end') { onChangeEndDate(s); }
    else { onChangeDate(s); if (endDate && s >= endDate) onChangeEndDate(''); }
    setCalTarget(null); setHoverDate(null);
  };

  // ── Рендер элемента даты ─────────────────────────────────────
  const renderDateEl = (which: 'start' | 'end', fixed = false) => {
    const val    = which==='start' ? date : endDate;
    const isOpen = calTarget===which;
    const fixCls = fixed ? styles.datePillFixed : '';

    if (isOpen) {
      return (
        <div key={`edit-${which}`} className={[styles.datePillWrap, fixCls].join(' ')}>
          <input
            ref={dayRef}
            className={styles.segInput}
            value={editDay}
            placeholder="ДД"
            inputMode="numeric"
            autoComplete="off"
            onChange={e => handleDayChange(e.target.value)}
            onKeyDown={e => handleSegKeyDown('day', e)}
            onFocus={e => e.target.select()}
          />
          <span className={styles.segSep}>.</span>
          <input
            ref={monRef}
            className={styles.segInput}
            value={editMon}
            placeholder="ММ"
            inputMode="numeric"
            autoComplete="off"
            onChange={e => handleMonChange(e.target.value)}
            onKeyDown={e => handleSegKeyDown('mon', e)}
            onFocus={e => e.target.select()}
          />
          <span className={styles.segSep}>.</span>
          <input
            ref={yearRef}
            className={[styles.segInput, styles.segInputYear].join(' ')}
            value={editYear}
            placeholder="ГГГГ"
            inputMode="numeric"
            autoComplete="off"
            onChange={e => handleYearChange(e.target.value)}
            onKeyDown={e => handleSegKeyDown('year', e)}
            onFocus={e => e.target.select()}
          />
        </div>
      );
    }

    return (
      <button
        key={`pill-${which}`}
        type="button"
        className={[styles.datePill, fixCls].join(' ')}
        onClick={() => openEdit(which)}
      >
        {val ? fmtDisplay(val) : <span className={styles.datePillPlaceholder}>ДД.ММ.ГГГГ</span>}
      </button>
    );
  };

  if (!pos) return null;

  return (
    <>
      <div className={styles.backdrop} onMouseDown={onClose} />
      <div className={styles.popup} style={{ top: pos.top, left: pos.left }} onMouseDown={e=>e.stopPropagation()}>

        {/* ── 1: Shortcuts ── */}
        <div className={styles.shortcuts}>
          {sc.map(s => (
            <button key={s.label} type="button"
              className={`${styles.shortcut} ${toStr(s.d)===date?styles.shortcutActive:''}`}
              onClick={() => selectDate(s.d)}
            >
              <span className={styles.scLabel}>{s.label}</span>
              <span className={styles.scRight}>{scRight(s.d, now)}</span>
            </button>
          ))}
        </div>

        <div className={styles.divider} />

        {/* ── 2: Date inputs + calendar ── */}
        <div className={styles.dateSection}>
          <div className={styles.dateRow}>
            {taskType !== 'mandatory' && multiDay ? (
              // Оба поля в общей обёртке — гарантирует равную ширину всегда
              <>
                <div className={styles.datePillPair}>
                  {renderDateEl('start', true)}
                  <span className={styles.dateSep}>→</span>
                  {renderDateEl('end', true)}
                </div>
                <button type="button" className={styles.multiClear}
                  onMouseDown={e=>e.preventDefault()}
                  onClick={() => { onChangeMultiDay(false); onChangeEndDate(''); setCalTarget(null); }}
                  title="Убрать конечную дату">✕</button>
              </>
            ) : (
              // Одиночная дата: поле + всегда видимая кнопка «+ до»
              <>
                {renderDateEl('start')}
                {taskType !== 'mandatory' && (
                  <button type="button" className={styles.multiAdd}
                    onClick={() => { onChangeMultiDay(true); setCalTarget(null); }}>+ до</button>
                )}
              </>
            )}
          </div>

          {calTarget !== null && (
            <div className={styles.calBody}>
              <div className={styles.calHead}>
                <button type="button" className={styles.calNav} onClick={prevMonth}>‹</button>
                <button type="button" className={styles.calTitleBtn}
                  onClick={() => { setCalYear(now.getFullYear()); setCalMonth(now.getMonth()); }}
                  title="К текущему месяцу">
                  {MONTH_NAME[calMonth]} {calYear}
                </button>
                <button type="button" className={styles.calNav} onClick={nextMonth}>›</button>
              </div>
              <div className={styles.calWds}>
                <span className={styles.calWdWeek}>Н</span>
                {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d=>(
                  <span key={d} className={styles.calWd}>{d}</span>
                ))}
              </div>
              {grid.map((row, ri) => {
                const hoverRange = getHoverRange();
                const firstCell  = row.find(c => c !== null);
                const weekNum    = firstCell ? getISOWeek(firstCell) : null;
                return (
                  <div key={ri} className={styles.calRow}>
                    <span className={styles.weekNum}>{weekNum}</span>
                    {row.map((cell, ci) => {
                      if (!cell) return <span key={ci} className={styles.calEmpty}/>;
                      const s = toStr(cell);
                      const hol = holidayMap.get(s);
                      const holColor = hol ? getHolidayColor(hol.type) : undefined;
                      const isHoverSel     = multiDay && hoverDate===s && hoverRange!==null;
                      const isHoverBetween = multiDay && hoverRange!==null && s>hoverRange.from && s<hoverRange.to;
                      const isDisabled     = calTarget === 'end' && !!date && s < date;
                      const isPreviewed    = !isDisabled && previewDate===s && s!==selStr && s!==endStr;
                      return (
                        <button key={ci} type="button"
                          disabled={isDisabled}
                          className={[
                            styles.calCell,
                            s===selStr                     ? styles.calSel         : '',
                            s===endStr                     ? styles.calEnd         : '',
                            multiDay&&s>selStr&&s<endStr   ? styles.calBetween     : '',
                            s===todayStr                   ? styles.calToday       : '',
                            isHoverSel                     ? styles.calHoverSel    : '',
                            isHoverBetween                 ? styles.calHoverBetween: '',
                            isPreviewed                    ? styles.calPreviewed   : '',
                          ].join(' ')}
                          onClick={() => handleDayClick(cell)}
                          onMouseEnter={() => multiDay && !isDisabled && setHoverDate(s)}
                          onMouseLeave={() => multiDay && setHoverDate(null)}
                          title={hol?.name||undefined}
                        >
                          <span style={holColor&&hol?.type!=='workday'?{color:holColor}:undefined}>
                            {cell.getDate()}
                          </span>
                          {hol && <span className={styles.calHolDot} style={{background:holColor}}/>}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.divider} />

        {/* ── 3: Repeat ── */}
        <div className={styles.repeatSection}>
          <div className={styles.repeatRow}>
            <button type="button"
              className={`${styles.repeatToggle} ${repeat!=='none'?styles.repeatToggleActive:''}`}
              onClick={() => setRepeatOpen(v=>!v)}>
              {repeatLabel}
            </button>
            {repeat !== 'none' && <button type="button" className={styles.repeatClear} onClick={clearRepeat}>✕</button>}
          </div>
          {repeatOpen && (
            <div className={styles.repeatDropdown}>
              {repeatOpts.map(opt => (
                <button key={opt.value} type="button"
                  className={`${styles.repeatItem} ${repeat===opt.value?styles.repeatItemActive:''}`}
                  onClick={() => handleRepeatSelect(opt.value)}>
                  {opt.text}
                </button>
              ))}
              <div className={styles.repeatDivider}/>
              <button type="button" className={styles.repeatConfigure}
                onClick={() => { setRepeatOpen(false); onOpenRepeatConfig(); }}>
                + Настроить
              </button>
            </div>
          )}
          {repeat !== 'none' && (
            <div className={styles.repeatUntilRow}>
              <label className={styles.repeatUntilLabel}>
                <input type="checkbox" checked={hasRepeatUntil}
                  onChange={e => { onChangeHasRepeatUntil(e.target.checked); if (!e.target.checked) onChangeRepeatUntil(''); }}/>
                Повторять до
              </label>
              {hasRepeatUntil && (
                <input className={styles.repeatUntilInput} type="date" value={repeatUntil} min={date}
                  onChange={e => onChangeRepeatUntil(e.target.value)}/>
              )}
            </div>
          )}
        </div>

      </div>
    </>
  );
}
