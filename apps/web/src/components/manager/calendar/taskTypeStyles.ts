import styles from './Calendar.module.scss';

// ── Chart view ────────────────────────────────────────────────
export const TYPE_CLS: Record<string, string> = {
  mandatory: styles.chartTaskMandatory,
  event:     styles.chartTaskEvent,
  normal:    styles.chartTaskNormal,
};
