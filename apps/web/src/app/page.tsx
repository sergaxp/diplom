'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2, Calendar, Cloud, Sparkles, Tags, Trophy, Repeat, ShoppingBag,
} from 'lucide-react';
import { Header } from '../components/Header';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import styles from './page.module.scss';

interface PublicStats { totalUsers: number; onlineUsers: number; deletedToday: number; }

export default function Home() {
  const { user, ready } = useAuthStore();
  const router = useRouter();

  // Авторизованный пользователь → сразу в менеджер
  useEffect(() => {
    if (ready && user) router.replace('/manager');
  }, [ready, user, router]);

  // Живая статистика – обновляется каждые 10 секунд
  const { data: stats } = useQuery<PublicStats>({
    queryKey: ['public-stats'],
    queryFn: () => api.get<PublicStats>('/users/stats').then(r => r.data),
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });

  // Пока проверяем токен или пользователь авторизован – не рендерим лендинг
  if (!ready || user) {
    return <div className={styles.root}><Header /></div>;
  }

  return (
    <div className={styles.root}>
      <Header />

      <main className={styles.main}>

        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>
            Организуй день.<br />
            <span className={styles.heroAccent}>Сосредоточься на важном.</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Warmingtea –  таск-менеджер для личной продуктивности с гибкими настройками задач,
            прогнозом погоды, праздничным календарём и геймификацией.
            Создавай задачи, отслеживай прогресс и развивай полезные привычки.
          </p>

          {/* ── Theme-aware preview ───────────────────────────────── */}
        <section className={styles.previewWrap}>
          <img src="/white.png" alt="Warmingtea preview"
            className={[styles.preview, styles.previewLight].join(' ')} />
          <img src="/dark.png"  alt="Warmingtea preview"
            className={[styles.preview, styles.previewDark].join(' ')} />
        </section>

        <br />

          <div className={styles.heroCta}>
            <Link href="/auth" className={styles.primaryBtn}>Начать бесплатно</Link>
            <Link href="/auth?mode=login" className={styles.secondaryBtn}>Войти</Link>
          </div>

          {/* ── Live stats ──────────────────────────────────── */}
          <div className={styles.stats}>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Зарегистрировано</span>
              <span className={styles.statValue}>
                {stats ? stats.totalUsers.toLocaleString('ru-RU') : '– '}
              </span>
              <span className={styles.statHint}>пользователей</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabelLive}>
                <span className={styles.liveDot} />
                Онлайн сейчас
              </span>
              <span className={styles.statValue}>
                {stats ? stats.onlineUsers.toLocaleString('ru-RU') : '– '}
              </span>
              <span className={styles.statHint}>пользователей</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Удалили аккаунт сегодня</span>
              <span className={styles.statValue}>
                {stats ? stats.deletedToday.toLocaleString('ru-RU') : '– '}
              </span>
              <span className={styles.statHint}>с начала суток</span>
            </div>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────── */}
        <section className={styles.features}>
          <h2 className={styles.sectionTitle}>Что внутри</h2>
          <div className={styles.featureGrid}>
            <FeatureCard
              icon={<CheckCircle2 size={22} strokeWidth={1.75} />}
              title="Задачи и подзадачи"
              text="Группируй работу по разделам, добавляй описание, файлы и ссылки прямо к подзадачам."
            />
            <FeatureCard
              icon={<Calendar size={22} strokeWidth={1.75} />}
              title="Календарь и график"
              text="Просматривай день, неделю, месяц, квартал и год. Все задачи на одном экране."
            />
            <FeatureCard
              icon={<Cloud size={22} strokeWidth={1.75} />}
              title="Погода"
              text="Прогноз на 16 дней вперёд прямо в карточке задачи и календаре."
            />
            <FeatureCard
              icon={<Sparkles size={22} strokeWidth={1.75} />}
              title="Праздничный календарь"
              text="Производственный календарь: переносы, сокращённые дни и рабочие субботы."
            />
            <FeatureCard
              icon={<Tags size={22} strokeWidth={1.75} />}
              title="Кастомные теги"
              text="Свои теги для своих задач."
            />
            <FeatureCard
              icon={<Repeat size={22} strokeWidth={1.75} />}
              title="Повторы и сложные правила"
              text="Ежедневно, по будням, по дням недели, циклы и условия по погоде."
            />
            <FeatureCard
              icon={<Trophy size={22} strokeWidth={1.75} />}
              title="Достижения и опыт"
              text="Получай XP за выполнение задач, прокачивай уровень и собирай ачивки."
            />
            <FeatureCard
              icon={<ShoppingBag size={22} strokeWidth={1.75} />}
              title="Магазин и монеты"
              text="Зарабатывай монеты за достижения и ежедневный вход, покупай рамки для аватара."
            />
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────── */}
        <section className={styles.steps}>
          <h2 className={styles.sectionTitle}>Как начать</h2>
          <div className={styles.stepList}>
            <Step n={1} title="Зарегистрируйся" text="Бесплатно, за 30 секунд. Только логин, email и пароль." />
            <Step n={2} title="Создай первую задачу" text="Добавь название, дату, тег и поехали. Можно сразу настроить повтор." />
            <Step n={3} title="Возвращайся каждый день" text="Серии, достижения и монетки помогут не сорваться с привычки." />
          </div>
        </section>

        {/* ── Footer CTA ───────────────────────────────────────── */}
        <section className={styles.footerCta}>
          <h2 className={styles.footerCtaTitle}>Готов начать?</h2>
          <p className={styles.footerCtaText}>
            Присоединяйся к {stats ? stats.totalUsers.toLocaleString('ru-RU') : '…'} пользователям, которые уже используют Warmingtea.
          </p>
          <Link href="/auth" className={styles.primaryBtn}>Создать аккаунт</Link>
        </section>

      </main>
    </div>
  );
}

function FeatureCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className={styles.featureCard}>
      <div className={styles.featureIcon}>{icon}</div>
      <div className={styles.featureTitle}>{title}</div>
      <div className={styles.featureText}>{text}</div>
    </div>
  );
}

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <div className={styles.step}>
      <div className={styles.stepNum}>{n}</div>
      <div>
        <div className={styles.stepTitle}>{title}</div>
        <div className={styles.stepText}>{text}</div>
      </div>
    </div>
  );
}
