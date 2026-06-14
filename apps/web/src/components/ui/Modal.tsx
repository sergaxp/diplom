'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';
import styles from './Modal.module.scss';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Заголовок в шапке. Если задан — рендерится header со слотом close-кнопки. */
  title?: ReactNode;
  /** Кастомное содержимое шапки (вместо стандартного title). */
  header?: ReactNode;
  /** Футер с действиями (обычно кнопки). */
  footer?: ReactNode;
  size?: ModalSize;
  /** Закрытие по клику на overlay. По умолчанию true. */
  closeOnOverlayClick?: boolean;
  /** Закрытие по Escape. По умолчанию true. */
  closeOnEscape?: boolean;
  /** Скрыть стандартную X-кнопку (если есть свой title). */
  hideCloseButton?: boolean;
  ariaLabel?: string;
  className?: string;
  /** Класс на внутреннем .body. Полезно для custom layouts. */
  bodyClassName?: string;
  /** Убрать стандартный padding у body (для custom layouts). */
  noPadding?: boolean;
  children?: ReactNode;
}

export function Modal({
  open,
  onClose,
  title,
  header,
  footer,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  hideCloseButton = false,
  ariaLabel,
  className,
  bodyClassName,
  noPadding = false,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Портал монтируем только на клиенте: на сервере (SSR) нет document, а сам
  // портал нужен, чтобы fixed-оверлей не «прилипал» к трансформированному
  // предку (напр. модалке внутри модалки — у родителя есть transform от анимации).
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Закрытие по Escape
  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, closeOnEscape, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Фокус-менеджмент: переносим фокус в модалку при открытии,
  // возвращаем на предыдущий элемент при закрытии, ловим Tab внутри.
  useEffect(() => {
    if (!open) return;
    const prevFocused = document.activeElement as HTMLElement | null;

    const focusables = () => {
      const el = dialogRef.current;
      if (!el) return [] as HTMLElement[];
      return Array.from(
        el.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(n => n.offsetParent !== null);
    };

    // Первый фокус. На тач-устройствах НЕ фокусируем первый input — иначе при
    // открытии модалки сразу всплывает клавиатура. Фокусируем сам диалог
    // (для трапа фокуса/Esc). На десктопе — первый интерактивный элемент.
    const t = setTimeout(() => {
      const finePointer =
        typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches;
      const items = focusables();
      const target = finePointer ? (items[0] ?? dialogRef.current) : dialogRef.current;
      target?.focus();
    }, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKeyDown);
      prevFocused?.focus?.();
    };
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
          onMouseDown={(e) => {
            if (closeOnOverlayClick && e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            tabIndex={-1}
            className={[styles.modal, styles[`size-${size}`], className].filter(Boolean).join(' ')}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
          >
            {(header || title) && (
              <div className={styles.header}>
                {header ?? <h2 className={styles.title}>{title}</h2>}
                {!hideCloseButton && (
                  <IconButton
                    icon={<X size={20} />}
                    aria-label="Закрыть"
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                  />
                )}
              </div>
            )}
            <div
              className={[
                styles.body,
                noPadding && styles.bodyNoPadding,
                bodyClassName,
              ].filter(Boolean).join(' ')}
            >
              {children}
            </div>
            {footer && <div className={styles.footer}>{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
