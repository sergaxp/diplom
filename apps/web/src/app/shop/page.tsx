'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ShoppingBag } from 'lucide-react';
import { fadeInUp, listContainer, listItem } from '../../lib/motion';
import { Header } from '../../components/Header';
import { AvatarFramed } from '../../components/AvatarFramed';
import { useAuthStore } from '../../store/authStore';
import { usePageTitle } from '../../hooks/useTabTitle';
import { shopApi, ShopItem } from '../../lib/shop';
import { authApi } from '../../lib/auth';
import { Button, Card, Badge, Skeleton, EmptyState, CoinIcon } from '../../components/ui';
import { HeatmapGrid } from '../../components/manager/heatmap/HeatmapGrid';
import { DayCount } from '../../lib/activity';
import styles from './page.module.scss';

/** Демо-данные для превью heatmap в карточке магазина. */
const HEATMAP_SAMPLE: DayCount[] = Array.from({ length: 120 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - i);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { date, count: (i * 7) % 5 };
});

export default function ShopPage() {
  const { user, ready, setUser } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  usePageTitle('Магазин');

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
      setUser({ ...(user!), ...res.user });
      qc.invalidateQueries({ queryKey: ['shop', 'items'] });
      qc.invalidateQueries({ queryKey: ['profile'] });
      const fresh = await authApi.me().catch(() => null);
      if (fresh) setUser(fresh);
    },
  });

  if (!ready || !user) return null;

  const coins = user.coins ?? 0;
  const errMsg = (buyMut.error as { response?: { data?: { message?: string } } } | null)?.response?.data?.message;

  const frames = items.filter(i => i.kind === 'frame');
  const backgrounds = items.filter(i => i.kind === 'background');
  const showcases = items.filter(i => i.kind === 'showcase');

  return (
    <div className={styles.root}>
      <Header />
      <motion.div className={styles.body} variants={fadeInUp} initial="hidden" animate="visible">
        <Card padding="lg" className={styles.card}>
          <div className={styles.head}>
            <h1 className={styles.title}>Магазин</h1>
            <Badge variant="accent" shape="pill" title="Ваши монеты">
              <CoinIcon className={styles.coinIcon} />
              <span className={styles.coinsValue}>{coins}</span>
            </Badge>
          </div>

          <p className={styles.subtitle}>
            Зарабатывайте монеты за выполнение достижений
            и за ежедневный вход в приложение.
          </p>

          {errMsg && <div className={styles.error}>{errMsg}</div>}

          {isLoading ? (
            <>
              <h2 className={styles.section}>Рамки для аватара</h2>
              <div className={styles.grid}>
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} width="100%" height={220} />
                ))}
              </div>
            </>
          ) : frames.length === 0 ? (
            <EmptyState
              icon={<ShoppingBag size={48} strokeWidth={1.25} />}
              title="Магазин пока пуст"
              description="Загляните позже — новые товары скоро появятся."
            />
          ) : (
            <>
              <h2 className={styles.section}>Рамки для аватара</h2>
              <motion.div
                className={styles.grid}
                variants={listContainer}
                initial="hidden"
                animate="visible"
              >
                {frames.map(item => (
                  <motion.div key={item.id} variants={listItem} className={styles.gridItem}>
                    <ShopItemCard
                      item={item}
                      user={user}
                      onBuy={() => buyMut.mutate(item.id)}
                      busy={buyMut.isPending && buyMut.variables === item.id}
                    />
                  </motion.div>
                ))}
              </motion.div>

              {backgrounds.length > 0 && (
                <>
                  <h2 className={styles.section}>Фоны профиля</h2>
                  <motion.div
                    className={styles.grid}
                    variants={listContainer}
                    initial="hidden"
                    animate="visible"
                  >
                    {backgrounds.map(item => (
                      <motion.div key={item.id} variants={listItem} className={styles.gridItem}>
                        <ShopItemCard
                          item={item}
                          user={user}
                          onBuy={() => buyMut.mutate(item.id)}
                          busy={buyMut.isPending}
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                </>
              )}

              {showcases.length > 0 && (
                <>
                  <h2 className={styles.section}>Витрины профиля</h2>
                  <motion.div
                    className={styles.grid}
                    variants={listContainer}
                    initial="hidden"
                    animate="visible"
                  >
                    {showcases.map(item => (
                      <motion.div key={item.id} variants={listItem} className={styles.gridItem}>
                        <ShopItemCard
                          item={item}
                          user={user}
                          onBuy={() => buyMut.mutate(item.id)}
                          busy={buyMut.isPending && buyMut.variables === item.id}
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                </>
              )}
            </>
          )}
        </Card>
      </motion.div>
    </div>
  );
}

interface ItemCardProps {
  item: ShopItem;
  user: { avatarUrl: string | null; username: string; displayName: string | null };
  onBuy: () => void;
  busy: boolean;
}

/** Превью фона в карточке магазина: автопроигрываемое видео или градиент. */
function BgPreview({
  gradient,
  video,
  animated,
}: {
  gradient?: string;
  video?: string;
  animated: boolean;
}) {
  if (video) {
    return (
      <div className={styles.bgPreview}>
        <video
          className={styles.bgPreviewVideo}
          src={video}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
        {animated && <span className={styles.bgPreviewTag}>анимир.</span>}
      </div>
    );
  }

  return (
    <div
      className={[styles.bgPreview, animated ? styles.bgPreviewAnimated : ''].join(' ')}
      style={{ backgroundImage: gradient }}
    >
      {animated && <span className={styles.bgPreviewTag}>анимир.</span>}
    </div>
  );
}

function ShopItemCard({ item, user, onBuy, busy }: ItemCardProps) {
  const color = item.meta?.color;
  const isBackground = item.kind === 'background';
  const isShowcase = item.kind === 'showcase';
  const animated = item.meta?.animated === '1';

  return (
    <Card
      padding="md"
      className={[styles.itemCard, item.owned ? styles.itemCardOwned : ''].join(' ')}
    >
      <div className={styles.preview}>
        {isShowcase ? (
          <div className={styles.showcasePreview}>
            <HeatmapGrid days={HEATMAP_SAMPLE} weeks={16} caption="" />
          </div>
        ) : isBackground ? (
          <BgPreview
            gradient={item.meta?.gradient}
            video={item.meta?.video}
            animated={animated}
          />
        ) : (
          <>
            <AvatarFramed
              avatarUrl={user.avatarUrl}
              displayName={user.displayName}
              username={user.username}
              frameId={item.id}
              size={80}
              animate
            />
            {animated && <span className={styles.bgPreviewTag}>анимир.</span>}
          </>
        )}
      </div>
      <div className={styles.itemTitle} style={color ? { color } : undefined}>
        {item.title}
      </div>
      <div className={styles.itemDesc}>{item.description}</div>
      <div className={styles.itemFooter}>
        <span className={styles.itemPrice}>
          <CoinIcon className={styles.coinIcon} /> {item.price}
        </span>
        {item.owned ? (
          <Badge variant="success">Куплено</Badge>
        ) : (
          <Button
            variant="accent"
            size="sm"
            onClick={onBuy}
            loading={busy}
          >
            Купить
          </Button>
        )}
      </div>
    </Card>
  );
}
