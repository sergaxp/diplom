import type { Metadata } from 'next';
import { Header } from '../components/Header';
import styles from './page.module.scss';

export const metadata: Metadata = {
  title: 'Warmingtea — твоё личное пространство',
};

const sections = [
  { key: 'manager', label: 'Manager', href: '/manager',  desc: 'Задачи, привычки, геймификация', icon: '◈' },
  { key: 'mail',    label: 'Mail',    href: '/mail',     desc: 'Почта @warmingtea.su',          icon: '✦' },
  { key: 'lists',   label: 'Lists',   href: '/lists',    desc: 'Аниме, фильмы, игры',           icon: '◉' },
  { key: 'docs',    label: 'Docs',    href: '/docs',     desc: 'Документация и FAQ',             icon: '◫' },
  { key: 'stuff',   label: 'Stuff',   href: '/stuff',    desc: 'Вишлист, история, поддержка',   icon: '◎' },
  { key: 'tunel',   label: 'Tunel',   href: '/tunel',    desc: 'VPN подписка и клиенты',        icon: '⬡' },
];

export default function Home() {
  return (
    <div className={styles.root}>
      <div className={styles.grain} aria-hidden />
      <div className={styles.blob1} aria-hidden />
      <div className={styles.blob2} aria-hidden />
      <div className={styles.blob3} aria-hidden />

      <Header />

      <main className={styles.main}>
        {/* Hero */}
        <section className={styles.hero}>
          <div className={styles.eyebrow}>
            <span className={styles.dot} />
            Персональная платформа
          </div>
          <h1 className={styles.title}>
            Всё твоё —<br />
            <em>в одном месте</em>
          </h1>
          <p className={styles.subtitle}>
            Задачи, почта, списки аниме и фильмов, вишлист и VPN-подписка.
            <br />
            Один аккаунт — весь функционал.
          </p>
          <div className={styles.cta}>
            <a href="/auth" className={styles.ctaPrimary}>Начать бесплатно</a>
            <a href="/docs"  className={styles.ctaSecondary}>Узнать больше →</a>
          </div>
        </section>

        {/* Сетка разделов */}
        <section className={styles.grid}>
          {sections.map((s, i) => (
            <a
              key={s.key}
              href={s.href}
              className={styles.card}
              style={{ '--i': i } as React.CSSProperties}
            >
              <span className={styles.cardIcon}>{s.icon}</span>
              <div className={styles.cardBody}>
                <span className={styles.cardLabel}>{s.label}</span>
                <span className={styles.cardDesc}>{s.desc}</span>
              </div>
              <span className={styles.cardArrow}>↗</span>
            </a>
          ))}
        </section>

        {/* About */}
        <section className={styles.about}>
          <div className={styles.aboutLeft}>
            <h2 className={styles.aboutTitle}>Один разработчик.<br />Много тепла.</h2>
            <p className={styles.aboutText}>
              Warmingtea — личный проект, созданный с заботой о деталях.
              Здесь нет корпоративного холода — только функциональный,
              уютный и искренний инструмент для повседневной жизни.
            </p>
            <div className={styles.socials}>
              <a href="#" className={styles.social}>Telegram</a>
              <a href="#" className={styles.social}>GitHub</a>
              <a href="/support" className={styles.social}>Поддержать</a>
            </div>
          </div>
          <div className={styles.stats}>
            {[
              { num: '01', label: 'разработчик' },
              { num: '∞',  label: 'возможностей' },
              { num: '☕', label: 'чашек чая' },
            ].map((s) => (
              <div key={s.label} className={styles.stat}>
                <span className={styles.statNum}>{s.num}</span>
                <span className={styles.statLabel}>{s.label}</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <span className={styles.footerLogo}>warmingtea.su</span>
        <div className={styles.footerLinks}>
          <a href="/history">История</a>
          <a href="/docs/privacy">Конфиденциальность</a>
          <a href="/docs/faq">FAQ</a>
          <a href="/support">Поддержать</a>
        </div>
        <span className={styles.footerCopy}>© 2025 Warmingtea</span>
      </footer>
    </div>
  );
}
