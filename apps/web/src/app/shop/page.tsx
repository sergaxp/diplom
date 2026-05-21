'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '../../components/Header';
import { AvatarFramed } from '../../components/AvatarFramed';
import { useAuthStore } from '../../store/authStore';
import { shopApi, ShopItem } from '../../lib/shop';
import { authApi } from '../../lib/auth';
import { fontFamilyFor } from '../../lib/fonts';
import styles from './page.module.scss';

export default function ShopPage() {
  const { user, ready, setUser } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    if (ready && !user) router.replace('/auth');
  }, [ready, user, router]);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['shop', 'items'],
    queryFn: shopApi.getItems,
    enabled: !!user,
  });

  const buyMut = useMutation({
    mutationFn: shopApi.buy,
    onSuccess: async (res) => {
      // Сервер уже автоэкипировал рамку. Обновляем локального пользователя.
      setUser({ ...(user!), ...res.user });
      qc.invalidateQueries({ queryKey: ['shop', 'items'] });
      // Подтягиваем свежие данные пользователя
      const fresh = await authApi.me().catch(() => null);
      if (fresh) setUser(fresh);
    },
  });

  if (!ready || !user) return null;

  const coins = user.coins ?? 0;
  const errMsg = (buyMut.error as { response?: { data?: { message?: string } } } | null)?.response?.data?.message;

  // Группировка по категориям
  const frames = items.filter(i => i.kind === 'frame');
  const fonts  = items.filter(i => i.kind === 'font');

  return (
    <div className={styles.root}>
      <Header />
      <div className={styles.body}>
        <div className={styles.card}>
          <div className={styles.head}>
            <h1 className={styles.title}>Магазин</h1>
            <div className={styles.coinsBadge} title="Ваши монеты">
              <span className={styles.coinIcon}>●</span>
              <span className={styles.coinsValue}>{coins}</span>
            </div>
          </div>

          <p className={styles.subtitle}>
            Зарабатывайте монеты за выполнение достижений (1–4 за уровень)
            и за ежедневный вход в приложение (+1).
          </p>

          {errMsg && <div className={styles.error}>{errMsg}</div>}

          {isLoading && <div className={styles.loading}>Загрузка…</div>}

          {!isLoading && (
            <>
              <h2 className={styles.section}>Рамки для аватара</h2>
              <div className={styles.grid}>
                {frames.map(item => (
                  <ShopItemCard
                    key={item.id}
                    item={item}
                    user={user}
                    onBuy={() => buyMut.mutate(item.id)}
                    busy={buyMut.isPending}
                  />
                ))}
              </div>

              {fonts.length > 0 && (
                <>
                  <h2 className={styles.section}>Шрифты</h2>
                  <p className={styles.sectionDesc}>
                    Шрифт применяется ко всему интерфейсу и виден другим пользователям на вашем профиле.
                  </p>
                  <div className={styles.grid}>
                    {fonts.map(item => (
                      <ShopItemCard
                        key={item.id}
                        item={item}
                        user={user}
                        onBuy={() => buyMut.mutate(item.id)}
                        busy={buyMut.isPending}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface CardProps {
  item: ShopItem;
  user: { avatarUrl: string | null; username: string; displayName: string | null };
  onBuy: () => void;
  busy: boolean;
}

function ShopItemCard({ item, user, onBuy, busy }: CardProps) {
  const color = item.meta?.color;
  const isFont = item.kind === 'font';
  const fontFamily = isFont ? fontFamilyFor(item.meta?.key ?? null) : undefined;

  return (
    <div className={[styles.itemCard, item.owned ? styles.itemCardOwned : ''].join(' ')}>
      <div className={styles.preview}>
        {isFont ? (
          <div className={styles.fontPreview} style={{ fontFamily }}>
            <span className={styles.fontPreviewBig}>Aa</span>
            <span className={styles.fontPreviewLine}>Быстрая лиса 1234</span>
          </div>
        ) : (
          <AvatarFramed
            avatarUrl={user.avatarUrl}
            displayName={user.displayName}
            username={user.username}
            frameId={item.id}
            size={80}
          />
        )}
      </div>
      <div
        className={styles.itemTitle}
        style={color ? { color } : (isFont ? { fontFamily } : undefined)}
      >
        {item.title}
      </div>
      <div className={styles.itemDesc}>{item.description}</div>
      <div className={styles.itemFooter}>
        <span className={styles.itemPrice}>
          <span className={styles.coinIcon}>●</span> {item.price}
        </span>
        {item.owned ? (
          <span className={styles.ownedBadge}>Куплено</span>
        ) : (
          <button
            type="button"
            className={styles.buyBtn}
            onClick={onBuy}
            disabled={busy}
          >
            {busy ? '...' : 'Купить'}
          </button>
        )}
      </div>
    </div>
  );
}
