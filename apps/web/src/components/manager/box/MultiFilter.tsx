'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { popLayer } from '../../../lib/motion';
import styles from './BoxView.module.scss';

export interface FilterOption {
  value: string;
  label: string;
  /** Цветная точка слева (для тегов). */
  dot?: string;
}

interface Props {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
}

export function MultiFilter({ label, options, selected, onChange }: Props) {
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

  const toggle = (value: string) => {
    onChange(selected.includes(value)
      ? selected.filter(v => v !== value)
      : [...selected, value]);
  };

  return (
    <div className={styles.filterWrap} ref={ref}>
      <button
        type="button"
        className={[styles.filterBtn, selected.length > 0 ? styles.filterBtnActive : ''].join(' ')}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        {label}
        {selected.length > 0 && <span className={styles.filterCount}>{selected.length}</span>}
        <ChevronDown size={13} strokeWidth={2} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div className={styles.filterMenu}
            variants={popLayer} initial="hidden" animate="visible" exit="exit">
            {options.map(opt => {
              const on = selected.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={styles.filterOption}
                  onClick={() => toggle(opt.value)}
                >
                  <span className={[styles.checkBox, on ? styles.checkBoxOn : ''].join(' ')}>
                    {on && <Check size={11} strokeWidth={3} />}
                  </span>
                  {opt.dot && <span className={styles.optDot} style={{ background: opt.dot }} />}
                  <span className={styles.optLabel}>{opt.label}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
