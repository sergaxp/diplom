import styles from './not-found.module.scss';

export default function NotFound() {
  return (
    <main className={styles.root}>
      <span className={styles.code}>404</span>
    </main>
  );
}
