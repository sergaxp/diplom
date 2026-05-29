'use client';

import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes, ReactNode, useId } from 'react';
import styles from './Input.module.scss';

export type InputSize = 'sm' | 'md' | 'lg';

interface CommonProps {
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
  size?: InputSize;
  className?: string;
  wrapClassName?: string;
}

export type InputProps = CommonProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(props, ref) {
  const {
    label,
    helper,
    error,
    required,
    prefix,
    suffix,
    size = 'md',
    className,
    wrapClassName,
    id: idProp,
    disabled,
    // По умолчанию отключаем автозаполнение браузера — иначе над клавиатурой
    // на мобильных всплывает панель «ключ/карта/адрес». Поля логина/пароля
    // (на /auth) передают свой autoComplete и переопределяют это.
    autoComplete = 'off',
    ...rest
  } = props;

  const autoId = useId();
  const id = idProp ?? autoId;
  const helperId = helper ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={[styles.wrap, wrapClassName].filter(Boolean).join(' ')}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
          {required && <span className={styles.required} aria-hidden="true">*</span>}
        </label>
      )}
      <div
        className={[
          styles.field,
          styles[`size-${size}`],
          error && styles.error,
          disabled && styles.disabled,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {prefix && <span className={styles.prefix}>{prefix}</span>}
        <input
          ref={ref}
          id={id}
          className={[styles.input, className].filter(Boolean).join(' ')}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : helperId}
          required={required}
          autoComplete={autoComplete}
          {...rest}
        />
        {suffix && <span className={styles.suffix}>{suffix}</span>}
      </div>
      {error ? (
        <span id={errorId} className={styles.errorMsg} role="alert">
          {error}
        </span>
      ) : helper ? (
        <span id={helperId} className={styles.helper}>
          {helper}
        </span>
      ) : null}
    </div>
  );
});

/* ── Textarea ──────────────────────────────────────────────── */

export type TextareaProps = Omit<CommonProps, 'prefix' | 'suffix'> &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  props,
  ref,
) {
  const {
    label,
    helper,
    error,
    required,
    size = 'md',
    className,
    wrapClassName,
    id: idProp,
    disabled,
    // По умолчанию отключаем автозаполнение браузера — иначе над клавиатурой
    // на мобильных всплывает панель «ключ/карта/адрес». Поля логина/пароля
    // (на /auth) передают свой autoComplete и переопределяют это.
    autoComplete = 'off',
    ...rest
  } = props;

  const autoId = useId();
  const id = idProp ?? autoId;
  const helperId = helper ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={[styles.wrap, wrapClassName].filter(Boolean).join(' ')}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
          {required && <span className={styles.required} aria-hidden="true">*</span>}
        </label>
      )}
      <div
        className={[
          styles.field,
          styles[`size-${size}`],
          error && styles.error,
          disabled && styles.disabled,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <textarea
          ref={ref}
          id={id}
          className={[styles.input, styles.textarea, className].filter(Boolean).join(' ')}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : helperId}
          required={required}
          autoComplete={autoComplete}
          {...rest}
        />
      </div>
      {error ? (
        <span id={errorId} className={styles.errorMsg} role="alert">
          {error}
        </span>
      ) : helper ? (
        <span id={helperId} className={styles.helper}>
          {helper}
        </span>
      ) : null}
    </div>
  );
});
