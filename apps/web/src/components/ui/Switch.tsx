'use client';

import { forwardRef, InputHTMLAttributes } from 'react';
import styles from './Switch.module.scss';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  /** Подпись слева от переключателя (опционально, чаще label рисуют снаружи). */
  label?: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  function Switch({ label, className, disabled, ...rest }, ref) {
    return (
      <label className={[styles.wrap, disabled && styles.disabled, className].filter(Boolean).join(' ')}>
        {label && <span className={styles.label}>{label}</span>}
        <span className={styles.switch}>
          <input ref={ref} type="checkbox" className={styles.input} disabled={disabled} {...rest} />
          <span className={styles.track} aria-hidden />
          <span className={styles.thumb} aria-hidden />
        </span>
      </label>
    );
  },
);
