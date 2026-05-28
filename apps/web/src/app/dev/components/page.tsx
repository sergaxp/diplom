'use client';

import { useState } from 'react';
import { Plus, Trash2, Search, Settings } from 'lucide-react';
import { Header } from '../../../components/Header';
import {
  Button, IconButton, Card, Badge, Input, Textarea,
  PageContainer, Modal, Skeleton, EmptyState,
} from '../../../components/ui';
import type { ButtonVariant, ButtonSize, BadgeVariant } from '../../../components/ui';
import styles from './page.module.scss';

const BTN_VARIANTS: ButtonVariant[] = ['primary', 'accent', 'secondary', 'ghost', 'destructive'];
const BTN_SIZES: ButtonSize[] = ['sm', 'md', 'lg'];
const BADGE_VARIANTS: BadgeVariant[] = [
  'neutral', 'brand', 'accent', 'success', 'error', 'warning', 'info',
  'rank-1', 'rank-2', 'rank-3', 'rank-4',
];

const COLOR_TOKENS = [
  '--bg-base', '--bg-surface', '--bg-elevated', '--bg-subtle',
  '--brand', '--brand-hover', '--brand-subtle', '--brand-muted',
  '--accent', '--accent-hover', '--accent-subtle',
  '--success', '--error', '--warning', '--info',
  '--border-card', '--border-default', '--border-strong',
];

export default function ComponentsShowcase() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className={styles.root}>
      <Header />
      <PageContainer variant="wide">
        <div className={styles.head}>
          <h1 className={styles.title}>Дизайн-система Warmingtea</h1>
          <p className={styles.subtitle}>Живая витрина UI-примитивов и токенов.</p>
        </div>

        {/* ── Buttons ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Button</h2>

          <div className={styles.subLabel}>Варианты</div>
          <div className={styles.row}>
            {BTN_VARIANTS.map(v => (
              <Button key={v} variant={v}>{v}</Button>
            ))}
          </div>

          <div className={styles.subLabel}>Размеры</div>
          <div className={styles.row}>
            {BTN_SIZES.map(s => (
              <Button key={s} variant="primary" size={s}>size {s}</Button>
            ))}
          </div>

          <div className={styles.subLabel}>Состояния</div>
          <div className={styles.row}>
            <Button variant="accent" leftIcon={<Plus size={16} strokeWidth={2} />}>С иконкой</Button>
            <Button variant="accent" loading>Загрузка</Button>
            <Button variant="accent" disabled>Disabled</Button>
            <Button variant="primary" href="#">Ссылка</Button>
          </div>
        </section>

        {/* ── IconButton ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>IconButton</h2>
          <div className={styles.row}>
            <IconButton icon={<Plus size={20} />} aria-label="Добавить" variant="primary" />
            <IconButton icon={<Settings size={20} />} aria-label="Настройки" variant="secondary" />
            <IconButton icon={<Search size={20} />} aria-label="Поиск" variant="ghost" />
            <IconButton icon={<Trash2 size={20} />} aria-label="Удалить" variant="destructive" />
          </div>
        </section>

        {/* ── Badge ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Badge</h2>
          <div className={styles.row}>
            {BADGE_VARIANTS.map(v => (
              <Badge key={v} variant={v}>{v}</Badge>
            ))}
          </div>
          <div className={styles.subLabel}>Pill-форма</div>
          <div className={styles.row}>
            <Badge variant="brand" shape="pill">Ур. 7</Badge>
            <Badge variant="accent" shape="pill">240 монет</Badge>
            <Badge variant="success" shape="pill">Активен</Badge>
          </div>
        </section>

        {/* ── Inputs ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Input / Textarea</h2>
          <div className={styles.formGrid}>
            <Input label="Обычное поле" placeholder="Введите текст" />
            <Input label="С префиксом" prefix="@" placeholder="username" />
            <Input label="С ошибкой" error="Это поле обязательно" defaultValue="!" />
            <Input label="С подсказкой" helper="Необязательно" placeholder="…" />
            <Textarea label="Многострочное" placeholder="Описание…" rows={3} />
          </div>
        </section>

        {/* ── Card ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Card</h2>
          <div className={styles.grid}>
            <Card variant="default" padding="md">
              <p className={styles.cardDemoTitle}>default</p>
              <p className={styles.cardDemo}>Базовая поверхность на странице.</p>
            </Card>
            <Card variant="elevated" padding="md">
              <p className={styles.cardDemoTitle}>elevated</p>
              <p className={styles.cardDemo}>Приподнятая — для модалок/popover.</p>
            </Card>
            <Card variant="interactive" padding="md" interactive>
              <p className={styles.cardDemoTitle}>interactive</p>
              <p className={styles.cardDemo}>Кликабельная (hover/focus).</p>
            </Card>
            <Card padding="md" stripeColor="var(--rank-amber-gold)">
              <p className={styles.cardDemoTitle}>с полоской ранга</p>
              <p className={styles.cardDemo}>stripeColor — достижения.</p>
            </Card>
          </div>
        </section>

        {/* ── Skeleton ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Skeleton</h2>
          <div className={styles.formGrid}>
            <Skeleton width="60%" height={20} />
            <Skeleton width="100%" height={48} />
            <div className={styles.row}>
              <Skeleton circle width={40} height={40} />
              <Skeleton text width={120} />
            </div>
          </div>
        </section>

        {/* ── EmptyState ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>EmptyState</h2>
          <Card padding="md">
            <EmptyState
              icon={<Plus size={48} strokeWidth={1.25} />}
              title="Здесь пока пусто"
              description="Описание пустого состояния в одно-два предложения."
              action={<Button variant="accent" size="sm">Действие</Button>}
            />
          </Card>
        </section>

        {/* ── Modal ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Modal</h2>
          <Button variant="primary" onClick={() => setModalOpen(true)}>Открыть модалку</Button>
          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Пример модального окна"
            footer={
              <>
                <Button variant="secondary" onClick={() => setModalOpen(false)}>Отмена</Button>
                <Button variant="accent" onClick={() => setModalOpen(false)}>Сохранить</Button>
              </>
            }
          >
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-base)', lineHeight: 1.5 }}>
              Анимация появления/исчезновения, закрытие по Escape и клику на фон,
              фокус-трап и блокировка прокрутки — встроены.
            </p>
          </Modal>
        </section>

        {/* ── Цветовые токены ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Цветовые токены</h2>
          <div className={styles.swatches}>
            {COLOR_TOKENS.map(token => (
              <div key={token} className={styles.swatch}>
                <div className={styles.swatchChip} style={{ background: `var(${token})` }} />
                <span className={styles.swatchName}>{token}</span>
              </div>
            ))}
          </div>
        </section>
      </PageContainer>
    </div>
  );
}
