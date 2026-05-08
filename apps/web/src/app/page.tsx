import Link from 'next/link';
import { Header } from '../components/Header';
import styles from './page.module.scss';

export default function Home() {
  return (
    <div className={styles.root}>
      <Header />
      <main className={styles.main}>
        <Link href="/manager" className={styles.startBtn}>Начать</Link>
      </main>
    </div>
  );
}
