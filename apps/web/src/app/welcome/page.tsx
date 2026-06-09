'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2, Calendar, Cloud, Sparkles, Tags, Trophy, Repeat, ShoppingBag,
} from 'lucide-react';
import { Header } from '../../components/Header';
import { Button, Card, PageContainer } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../lib/api';
import styles from './page.module.scss';

interface PublicStats { totalUsers: number; onlineUsers: number; registeredToday: number; }

export default function Home() {
  const { user, ready } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (ready && user) router.replace('/');
  }, [ready, user, router]);

  const { data: stats } = useQuery<PublicStats>({
    queryKey: ['public-stats'],
    queryFn: () => api.get<PublicStats>('/users/stats').then(r => r.data),
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });

  if (!ready || user) {
    return <div className={styles.root}><Header /></div>;
  }

  return (
    <div className={styles.root}>
      <Header />

      <main className={styles.main}>
        {/* ── Hero ─────────────────────────────────────────────── */}
        <PageContainer variant="narrow" padding="none" as="section" className={styles.hero}>
          <h1 className={styles.heroTitle}>
            Организуй день.<br />
            <span className={styles.heroAccent}>Сосредоточься на важном.</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Warmingtea — таск-менеджер для личной продуктивности с гибкими настройками задач,
            прогнозом погоды, праздничным календарём и геймификацией.
            Создавай задачи, отслеживай прогресс и развивай полезные привычки.
          </p>

          <div className={styles.previewWrap}>
            <Image src="/white.png" alt="Warmingtea preview" width={2373} height={1455} priority
              className={[styles.preview, styles.previewLight].join(' ')} />
            <Image src="/dark.png" alt="Warmingtea preview" width={2373} height={1455} priority
              className={[styles.preview, styles.previewDark].join(' ')} />
          </div>

          <div className={styles.heroCta}>
            <Button href="/auth" variant="accent" size="lg">Начать бесплатно</Button>
            <Button href="/auth?mode=login" variant="secondary" size="lg">Войти</Button>
          </div>

          <div className={styles.stats}>
            <StatCard
              label="Зарегистрировано"
              value={stats ? stats.totalUsers.toLocaleString('ru-RU') : '—'}
              hint="пользователей"
            />
            <StatCard
              label="Онлайн сейчас"
              value={stats ? stats.onlineUsers.toLocaleString('ru-RU') : '—'}
              hint="пользователей"
              live
            />
            <StatCard
              label="Новые пользователи"
              value={stats ? stats.registeredToday.toLocaleString('ru-RU') : '—'}
              hint="с начала суток"
            />
          </div>
        </PageContainer>

        {/* ── Features ─────────────────────────────────────────── */}
        <PageContainer variant="wide" padding="none" as="section" className={styles.features}>
          <h2 className={styles.sectionTitle}>Что внутри</h2>
          <div className={styles.featureGrid}>
            <FeatureCard
              icon={<CheckCircle2 size={24} strokeWidth={1.75} />}
              title="Задачи и подзадачи"
              text="Группируй работу по разделам, добавляй описание, файлы и ссылки прямо к подзадачам."
            />
            <FeatureCard
              icon={<Calendar size={24} strokeWidth={1.75} />}
              title="Календарь и график"
              text="Просматривай день, неделю, месяц, квартал и год. Все задачи на одном экране."
            />
            <FeatureCard
              icon={<Cloud size={24} strokeWidth={1.75} />}
              title="Погода"
              text="Прогноз на 16 дней вперёд прямо в карточке задачи и календаре."
            />
            <FeatureCard
              icon={<Sparkles size={24} strokeWidth={1.75} />}
              title="Праздничный календарь"
              text="Производственный календарь: переносы, сокращённые дни и рабочие субботы."
            />
            <FeatureCard
              icon={<Tags size={24} strokeWidth={1.75} />}
              title="Кастомные теги"
              text="Свои теги для своих задач."
            />
            <FeatureCard
              icon={<Repeat size={24} strokeWidth={1.75} />}
              title="Повторы и сложные правила"
              text="Ежедневно, по будням, по дням недели, циклы и условия по погоде."
            />
            <FeatureCard
              icon={<Trophy size={24} strokeWidth={1.75} />}
              title="Достижения и опыт"
              text="Получай XP за выполнение задач, прокачивай уровень и собирай ачивки."
            />
            <FeatureCard
              icon={<ShoppingBag size={24} strokeWidth={1.75} />}
              title="Магазин и монеты"
              text="Зарабатывай монеты за достижения и ежедневный вход, покупай рамки для аватара."
            />
          </div>
        </PageContainer>

        {/* ── How it works ─────────────────────────────────────── */}
        <PageContainer variant="narrow" padding="none" as="section" className={styles.steps}>
          <h2 className={styles.sectionTitle}>Как начать</h2>
          <div className={styles.stepList}>
            <Step n={1} title="Зарегистрируйся" text="Бесплатно, за 30 секунд. Только логин, email и пароль." />
            <Step n={2} title="Создай первую задачу" text="Добавь название, дату, тег и поехали. Можно сразу настроить повтор." />
            <Step n={3} title="Возвращайся каждый день" text="Серии, достижения и монетки помогут не сорваться с привычки." />
          </div>
        </PageContainer>

        {/* ── Footer CTA ───────────────────────────────────────── */}
        <PageContainer variant="narrow" padding="none" as="section">
          <Card padding="lg" className={styles.footerCta}>
            <h2 className={styles.footerCtaTitle}>Готов начать?</h2>
            <p className={styles.footerCtaText}>
              Присоединяйся к {stats ? stats.totalUsers.toLocaleString('ru-RU') : '…'} пользователям, которые уже используют Warmingtea.
            </p>
            <Button href="/auth" variant="accent" size="lg">Создать аккаунт</Button>
          </Card>
        </PageContainer>
      </main>
    </div>
  );
}

function StatCard({ label, value, hint, live }: { label: string; value: string; hint: string; live?: boolean }) {
  return (
    <Card padding="md" className={styles.statCard}>
      <span className={live ? styles.statLabelLive : styles.statLabel}>
        {live && <span className={styles.liveDot} aria-hidden="true" />}
        {label}
      </span>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statHint}>{hint}</span>
    </Card>
  );
}

function FeatureCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <Card padding="md" className={styles.featureCard}>
      <div className={styles.featureIcon}>{icon}</div>
      <div className={styles.featureTitle}>{title}</div>
      <div className={styles.featureText}>{text}</div>
    </Card>
  );
}

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <Card padding="md" className={styles.step}>
      <div className={styles.stepNum}>{n}</div>
      <div>
        <div className={styles.stepTitle}>{title}</div>
        <div className={styles.stepText}>{text}</div>
      </div>
    </Card>
  );
}
