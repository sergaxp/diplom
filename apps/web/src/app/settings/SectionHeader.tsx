import styles from './page.module.scss';

export function SectionHeader({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) {
  return (
    <div className={styles.pageHead}>
      <h1 className={styles.pageTitle}>{title}</h1>
      {subtitle && <p className={styles.pageSubtitle}>{subtitle}</p>}
    </div>
  );
}
