/* ============================================================
 * Общие варианты движения (framer-motion).
 * Единый источник истины, чтобы не плодить инлайн-объекты по
 * компонентам и держать тайминги согласованными с дизайн-системой.
 *
 * prefers-reduced-motion обрабатывается глобально через
 * <MotionConfig reducedMotion="user"> в providers/Providers.tsx —
 * трансформы гасятся автоматически, поэтому здесь дополнительных
 * проверок не требуется.
 * ============================================================ */
import type { Transition, Variants } from 'framer-motion';

// Кривые из дизайн-системы (globals.scss) в формате cubic-bezier-массива.
export const EASE_DEFAULT = [0.2, 0, 0, 1] as const;
export const EASE_OUT = [0, 0, 0.2, 1] as const;
export const EASE_SPRING = [0.34, 1.56, 0.64, 1] as const;

/* ── Плавающие слои (dropdown / menu / popover) ───────────────
 * «Вырастают» из триггера: лёгкий scale + сдвиг вверх + fade.
 * transform-origin задаётся на стороне компонента (обычно top).
 */
export const popLayer: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: -6 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.16, ease: EASE_SPRING },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: -4,
    transition: { duration: 0.12, ease: EASE_DEFAULT },
  },
};

/* ── Поповер, растущий снизу-вверх (контекстные попапы) ──────── */
export const popLayerUp: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 6 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.16, ease: EASE_SPRING },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 4,
    transition: { duration: 0.12, ease: EASE_DEFAULT },
  },
};

/* ── Списки со staggered-появлением ───────────────────────────
 * Контейнер дирижирует детьми; каждый элемент — fadeInUp.
 */
export const listContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.04, delayChildren: 0.02 },
  },
};

export const listItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: 0.14, ease: EASE_DEFAULT },
  },
};

/* ── Контент: появление страниц/вкладок ─────────────────────── */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.24, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.16, ease: EASE_DEFAULT },
  },
};

export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2, ease: EASE_DEFAULT } },
  exit: { opacity: 0, transition: { duration: 0.14, ease: EASE_DEFAULT } },
};

/* Готовый transition для layout-сдвигов соседей (AnimatePresence + layout). */
export const layoutTransition: Transition = { duration: 0.2, ease: EASE_DEFAULT };
