import { ReactNode } from 'react';
import styles from '../page.module.scss';

/**
 * Строка настройки в стиле Discord: слева название + описание/значение,
 * справа управление (значение + кнопка «Изменить», тумблер или произвольный node).
 */
export function SettingsRow({
  label,
  description,
  children,
  align = 'center',
}: {
  label: ReactNode;
  description?: ReactNode;
  /** Управление справа (кнопка, значение, тумблер, превью). */
  children?: ReactNode;
  /** Вертикальное выравнивание для высоких строк (превью изображений). */
  align?: 'center' | 'start';
}) {
  return (
    <div className={[styles.settingsRow, align === 'start' ? styles.settingsRowStart : ''].join(' ')}>
      <div className={styles.settingsRowMain}>
        <span className={styles.settingsRowLabel}>{label}</span>
        {description && <span className={styles.settingsRowDesc}>{description}</span>}
      </div>
      {children && <div className={styles.settingsRowControl}>{children}</div>}
    </div>
  );
}
