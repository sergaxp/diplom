'use client';

import { getBackgroundStyle } from '../../lib/shop';
import styles from './profile.module.scss';

/**
 * Полностраничная подложка профиля (Steam-style). Рендерится позади контента,
 * с лёгким полупрозрачным оверлеем для читаемости.
 * Приоритет: экипированный фон из магазина (selectedBackground: видео/картинка/
 * градиент) → загруженная картинка (backgroundUrl) → ничего.
 */
export function ProfileBackground({
  selectedBackground,
  url,
}: {
  selectedBackground?: string | null;
  url?: string | null;
}) {
  const shopBg = getBackgroundStyle(selectedBackground);

  if (!shopBg && !url) return null;

  return (
    <div className={styles.pageBg} aria-hidden="true">
      {shopBg?.video ? (
        <video
          className={`${styles.pageBgImage} ${styles.pageBgVideo}`}
          src={shopBg.video}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
      ) : shopBg?.gradient ? (
        <div
          className={[
            styles.pageBgImage,
            styles.pageBgGradient,
            shopBg.animated ? styles.pageBgAnimated : '',
          ].join(' ')}
          style={{ backgroundImage: shopBg.gradient }}
        />
      ) : (
        <div
          className={styles.pageBgImage}
          style={{ backgroundImage: `url(${shopBg?.image ?? url})` }}
        />
      )}
      <div className={styles.pageBgOverlay} />
    </div>
  );
}
