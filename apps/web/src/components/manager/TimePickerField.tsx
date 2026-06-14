'use client';

import { useEffect, useRef, useState } from 'react';
import { clampDrop } from './task-form/anchor';
import styles from './TimePickerField.module.scss';

// ── Helpers ──────────────────────────────────────────────────────

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function nowTotalMin(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function fmtRelative(slot: string): string {
  const diff = timeToMin(slot) - nowTotalMin();
  if (diff <= 0) return '';
  if (diff < 60) return `через ${diff}м`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m === 0 ? `через ${h}ч` : `через ${h}ч ${m}м`;
}

const ALL_SLOTS: string[] = (() => {
  const s: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      s.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
    }
  }
  return s;
})();

const ITEM_H = 32; // px – must match CSS

// ── Props ────────────────────────────────────────────────────────

interface Props {
  value: string;    // "HH:MM" or ""
  endValue: string; // "HH:MM" or ""
  taskDate: string; // "YYYY-MM-DD"
  /** Hide the "+ до" end-time button – single-time picker only. */
  hideEnd?: boolean;
  onChange: (v: string) => void;
  onChangeEnd: (v: string) => void;
}

// ── Component ────────────────────────────────────────────────────

export function TimePickerField({ value, endValue, taskDate, hideEnd, onChange, onChangeEnd }: Props) {
  const [editing, setEditing] = useState<null | 'start' | 'end'>(null);
  const [hrVal,   setHrVal]   = useState('');
  const [minVal,  setMinVal]  = useState('');
  const [dropPos, setDropPos] = useState<{ top: number; left: number } | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const hrRef   = useRef<HTMLInputElement>(null);
  const minRef  = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const isToday = todayIso() === taskDate;
  const hasRange = !!(endValue || editing === 'end');

  // Close end-editing if start is cleared
  useEffect(() => {
    if (!value && editing === 'end') { setEditing(null); setDropPos(null); }
  }, [value, editing]);

  // ── Slot helpers ──────────────────────────────────────────────

  const buildSlots = (which: 'start' | 'end'): string[] => {
    const nowMin = nowTotalMin();
    return ALL_SLOTS.filter(slot => {
      const slotMin = timeToMin(slot);
      if (which === 'start' && isToday && slotMin < nowMin) return false;
      if (which === 'end'   && value   && slotMin <= timeToMin(value)) return false;
      return true;
    });
  };

  const getAnchorIndex = (slots: string[], which: 'start' | 'end'): number => {
    const curVal = which === 'start' ? value : endValue;
    if (curVal) {
      const exact = slots.indexOf(curVal);
      if (exact >= 0) return exact;
      const idx = slots.findIndex(s => timeToMin(s) >= timeToMin(curVal));
      return idx >= 0 ? idx : 0;
    }
    if (isToday) return 0;
    // Для будущих/прошлых дней выбор времени начинаем с 6 утра, а не с текущего времени
    const idx = slots.indexOf('06:00');
    return idx >= 0 ? idx : 0;
  };

  // ── Open edit ─────────────────────────────────────────────────

  const openEdit = (which: 'start' | 'end') => {
    if (editing === which) { setEditing(null); setDropPos(null); return; }
    const curVal = which === 'start' ? value : endValue;
    if (curVal) {
      const [h, m] = curVal.split(':');
      setHrVal(h); setMinVal(m);
    } else {
      setHrVal(''); setMinVal('');
    }
    if (wrapRef.current) {
      const r   = wrapRef.current.getBoundingClientRect();
      const vw  = window.innerWidth;
      const dropW = Math.min(200, vw - 16);
      const dropH = ITEM_H * 5 + 16;
      setDropPos(clampDrop(r, dropW, dropH, vw, window.innerHeight));
    }
    setEditing(which);
    setTimeout(() => { hrRef.current?.focus(); hrRef.current?.select(); }, 0);
  };

  // ── Scroll dropdown to anchor when opened ─────────────────────

  useEffect(() => {
    if (!editing || !listRef.current) return;
    const slots = buildSlots(editing);
    const anchor = getAnchorIndex(slots, editing);
    listRef.current.scrollTop = Math.max(0, (anchor - 2) * ITEM_H);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  // ── Sync dropdown scroll while typing ────────────────────────

  useEffect(() => {
    if (!editing || !listRef.current) return;
    if (hrVal === '' && minVal === '') return; // let anchor effect handle initial scroll
    const h = parseInt(hrVal) || 0;
    const m = parseInt(minVal) || 0;
    const slots = buildSlots(editing);
    const idx = slots.findIndex(s => timeToMin(s) >= h * 60 + m);
    if (idx < 0) return;
    listRef.current.scrollTop = Math.max(0, (idx - 2) * ITEM_H);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hrVal, minVal]);

  // ── Close on outside click ────────────────────────────────────

  useEffect(() => {
    if (!editing) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const inWrap = wrapRef.current?.contains(target);
      const inList = listRef.current?.contains(target);
      if (!inWrap && !inList) { setEditing(null); setDropPos(null); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editing]);

  // ── Confirm ───────────────────────────────────────────────────

  const doConfirm = (hr: string, min: string) => {
    const h = parseInt(hr) || 0;
    const m = parseInt(min) || 0;
    const hh = h === 24 ? 0 : Math.min(h, 23);
    const mm = Math.min(m, 59);
    const result = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
    if (editing === 'start') {
      onChange(result);
      if (endValue && endValue <= result) onChangeEnd('');
    } else if (editing === 'end') {
      if (!value || result > value) onChangeEnd(result);
    }
    setEditing(null); setDropPos(null);
  };

  // ── Single clear button handler ───────────────────────────────

  const handleClear = () => {
    if (endValue) {
      onChangeEnd('');
      if (editing === 'end') { setEditing(null); setDropPos(null); }
    } else {
      onChange(''); onChangeEnd('');
      setEditing(null); setDropPos(null);
    }
  };

  // ── Focus helpers ─────────────────────────────────────────────

  const focusMin = () => { minRef.current?.focus(); setTimeout(() => minRef.current?.select(), 0); };
  const focusHr  = () => { hrRef.current?.focus(); setTimeout(() => hrRef.current?.select(), 0); };

  // ── Segment input handlers ────────────────────────────────────

  const handleHrChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    let val = digits.slice(0, 2);
    if (val.length === 1 && parseInt(val) > 2) val = '0' + val;
    if (val.length === 2) {
      const n = parseInt(val);
      if (n === 24) val = '00';
      else if (n > 23) val = '23';
      setHrVal(val);
      focusMin();
    } else {
      setHrVal(val);
    }
  };

  const handleMinChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    let val = digits.slice(0, 2);
    if (val.length === 1 && parseInt(val) > 5) val = '0' + val;
    if (val.length === 2) {
      if (parseInt(val) > 59) val = '59';
      setMinVal(val);
      doConfirm(hrVal, val);
    } else {
      setMinVal(val);
    }
  };

  // ── Space / Enter ─────────────────────────────────────────────

  const handleSpace = (seg: 'hr' | 'min') => {
    if (seg === 'hr') {
      const padded = hrVal === '' ? '00' : hrVal.padStart(2, '0');
      const n = parseInt(padded);
      const clamped = n === 24 ? '00' : String(Math.min(n, 23)).padStart(2, '0');
      setHrVal(clamped);
      focusMin();
    } else {
      doConfirm(
        hrVal  === '' ? '00' : hrVal.padStart(2, '0'),
        minVal === '' ? '00' : minVal.padStart(2, '0'),
      );
    }
  };

  const handleKeyDown = (seg: 'hr' | 'min', e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter')  { e.preventDefault(); handleSpace(seg); return; }
    if (e.key === 'Escape') { e.preventDefault(); setEditing(null); setDropPos(null); return; }
    if (e.key === ' ')      { e.preventDefault(); handleSpace(seg); return; }

    if ((e.key === ':' || e.key === '.') && seg === 'hr') {
      e.preventDefault();
      if (hrVal.length === 1) setHrVal(hrVal.padStart(2, '0'));
      focusMin();
      return;
    }

    if (e.key === 'Backspace') {
      const cur = e.currentTarget;
      if (cur.selectionStart === 0 && cur.selectionEnd === 0 && seg === 'min') {
        e.preventDefault(); focusHr();
      }
      return;
    }

    if (e.key === 'ArrowLeft' && e.currentTarget.selectionStart === 0 && seg === 'min') {
      e.preventDefault(); focusHr();
    }
    if (e.key === 'ArrowRight' && e.currentTarget.selectionStart === e.currentTarget.value.length && seg === 'hr') {
      e.preventDefault(); focusMin();
    }
  };

  // ── Select from dropdown ──────────────────────────────────────

  const selectSlot = (slot: string) => {
    if (editing === 'start') {
      onChange(slot);
      if (endValue && endValue <= slot) onChangeEnd('');
    } else if (editing === 'end') {
      if (!value || slot > value) onChangeEnd(slot);
    }
    setEditing(null); setDropPos(null);
  };

  // ── Segment inputs (shared for start & end) ───────────────────
  // inGroup=true → no outer border (group container provides it)

  const renderSegments = (inGroup = false) => (
    <div className={inGroup ? styles.groupSegWrap : styles.pillWrap}>
      <input
        ref={hrRef}
        className={styles.segInput}
        value={hrVal}
        placeholder="--"
        inputMode="numeric"
        autoComplete="off"
        onChange={e => handleHrChange(e.target.value)}
        onKeyDown={e => handleKeyDown('hr', e)}
        onFocus={e => e.target.select()}
      />
      <span className={styles.segSep}>:</span>
      <input
        ref={minRef}
        className={styles.segInput}
        value={minVal}
        placeholder="--"
        inputMode="numeric"
        autoComplete="off"
        onChange={e => handleMinChange(e.target.value)}
        onKeyDown={e => handleKeyDown('min', e)}
        onFocus={e => e.target.select()}
      />
    </div>
  );

  // ── Dropdown ──────────────────────────────────────────────────

  const renderDropdown = () => {
    if (!editing || !dropPos) return null;
    const slots = buildSlots(editing);
    const curVal = editing === 'start' ? value : endValue;

    const dropW = typeof window !== 'undefined' ? Math.min(200, window.innerWidth - 16) : 165;
    return (
      <ul
        ref={listRef}
        className={styles.dropdown}
        style={{ top: dropPos.top, left: dropPos.left, width: dropW }}
        onMouseDown={e => e.preventDefault()}
      >
        {slots.map(slot => {
          const rel = isToday ? fmtRelative(slot) : '';
          return (
            <li key={slot}>
              <button
                type="button"
                className={[styles.dropItem, slot === curVal ? styles.dropItemActive : ''].join(' ')}
                onClick={() => selectSlot(slot)}
              >
                <span>{slot}</span>
                {rel && <span className={styles.dropItemRel}>{rel}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  // ── Main render ───────────────────────────────────────────────

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <div className={styles.row}>

        {/* ── No value yet: "Время" pill or segments ── */}
        {!value && editing !== 'start' && (
          <button type="button" className={styles.pill} onClick={() => openEdit('start')}>
            <span className={styles.pillPlaceholder}>Время</span>
          </button>
        )}

        {/* ── Editing new (no prior value): standalone segments ── */}
        {!value && editing === 'start' && renderSegments(false)}

        {/* ── Has value, range mode: [start / end] ✕ ── */}
        {value && hasRange && (
          <>
            <div className={[
              styles.timeGroup,
              editing === 'start' || editing === 'end' ? styles.timeGroupActive : '',
            ].join(' ')}>
              {editing === 'start' ? renderSegments(true) : (
                <button type="button" className={styles.groupTimePill} onClick={() => openEdit('start')}>
                  {value}
                </button>
              )}
              <span className={styles.groupDivider} />
              {editing === 'end' ? renderSegments(true) : (
                <button type="button" className={styles.groupTimePill} onClick={() => openEdit('end')}>
                  {endValue || <span className={styles.pillPlaceholder}>ЧЧ:ММ</span>}
                </button>
              )}
            </div>
            <button
              type="button"
              className={styles.clearBtn}
              onMouseDown={e => e.preventDefault()}
              onClick={handleClear}
            >✕</button>
          </>
        )}

        {/* ── Has value, no end: grouped [start | + до] ✕ ── */}
        {value && !hasRange && (
          <>
            {hideEnd ? (
              editing === 'start' ? renderSegments(false) : (
                <button type="button" className={styles.pill} onClick={() => openEdit('start')}>
                  {value}
                </button>
              )
            ) : (
              <div className={[
                styles.timeGroup,
                editing === 'start' ? styles.timeGroupActive : '',
              ].join(' ')}>
                {editing === 'start' ? renderSegments(true) : (
                  <button type="button" className={styles.groupTimePill} onClick={() => openEdit('start')}>
                    {value}
                  </button>
                )}
                <span className={styles.groupDivider} />
                <button type="button" className={styles.groupAddEnd} onClick={() => openEdit('end')}>
                  + до
                </button>
              </div>
            )}
            <button
              type="button"
              className={styles.clearBtn}
              onMouseDown={e => e.preventDefault()}
              onClick={handleClear}
            >✕</button>
          </>
        )}

      </div>

      {renderDropdown()}
    </div>
  );
}
