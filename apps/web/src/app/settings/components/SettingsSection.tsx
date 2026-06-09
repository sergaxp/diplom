import { ReactNode } from 'react';
import styles from '../page.module.scss';

/**
 * Группа настроек в стиле Discord: серый UPPERCASE-заголовок + список строк.
 * Строки (`SettingsRow`) передаются как children.
 */
export function SettingsSection({
  title,
  description,
  danger,
  children,
}: {
  title?: string;
  description?: ReactNode;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={styles.settingsSection}>
      {title && (
        <h2 className={[styles.settingsSectionTitle, danger ? styles.settingsSectionTitleDanger : ''].join(' ')}>
          {title}
        </h2>
      )}
      {description && <p className={styles.settingsSectionDesc}>{description}</p>}
      <div className={styles.settingsRows}>{children}</div>
    </section>
  );
}
