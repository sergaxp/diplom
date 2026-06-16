'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, X } from 'lucide-react';
import { popLayer } from '../../../lib/motion';
import { BoxDateCalendar } from './BoxDateCalendar';
import styles from './BoxView.module.scss';

const MONTHS_SHORT = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];

function fmt(value: string, placeholder: string): string {
  if (!value) return placeholder;
  const d = new Date(value + 'T00:00:00');
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

interface Props {
  value: string;
  placeholder: string;
  onChange: (iso: string) => void;
}

export function DateFilterField({ value, placeholder, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div className={styles.dateField} ref={ref}>
      <button
        type="button"
        className={[styles.dateBtn, value ? styles.dateBtnActive : ''].join(' ')}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        <CalendarDays size={13} strokeWidth={2} />
        {fmt(value, placeholder)}
      </button>
      {value && (
        <button type="button" className={styles.dateClear} aria-label="Очистить дату"
          onClick={() => onChange('')}>
          <X size={12} strokeWidth={2.5} />
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div className={styles.datePop}
            variants={popLayer} initial="hidden" animate="visible" exit="exit">
            <BoxDateCalendar value={value}
              onChange={(iso) => { onChange(iso); setOpen(false); }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
