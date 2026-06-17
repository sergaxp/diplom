'use client';

import { CSSProperties } from 'react';
import { getFrameDeco } from '../lib/shop';
import styles from './AvatarFramed.module.scss';

interface Props {
  avatarUrl: string | null | undefined;
  displayName?: string | null;
  username?: string | null;
  frameId?: string | null;
  /** CSS pixel size of the avatar disk (without the decoration). */
  size?: number;
  /**
   * Постоянно проигрывать анимацию декорации. По умолчанию (false) анимация
   * идёт только при наведении мыши. true — для главного аватара в профиле.
   */
  animate?: boolean;
  className?: string;
}

const CSS_CLASS: Record<string, string> = {
  rgb: styles.cssRgb,
  blackhole: styles.cssBlackhole,
};

const ANIM_CLASS: Record<string, string> = {
  flame: styles.animFlame,
  blink: styles.animBlink,
  drip: styles.animDrip,
};

/**
 * Аватар с опциональной декорацией. Поддерживает два вида декораций (см.
 * FRAME_DECOS в lib/shop.ts):
 *  - картинка-оверлей «как у Discord» (deco.image) — абсолютно позиционированный
 *    <img> размером ~1.5× аватара, центрируется поверх диска;
 *  - программное анимированное CSS-кольцо (deco.css) — рисуется через ::before.
 */
export function AvatarFramed({
  avatarUrl,
  displayName,
  username,
  frameId,
  size = 32,
  animate = false,
  className,
}: Props) {
  const initial =
    (displayName?.trim()?.[0] ?? username?.[0] ?? '?').toUpperCase();
  const deco = getFrameDeco(frameId);
  const isCss = !!deco?.css;
  const ring = isCss ? Math.max(2, Math.round(size * 0.08)) : 0;

  const wrapStyle: CSSProperties = { width: size, height: size, padding: ring };

  const classes = [
    styles.wrap,
    isCss ? styles.cssFrame : '',
    isCss && deco?.css ? CSS_CLASS[deco.css] : '',
    deco?.animated && animate ? styles.alwaysAnimate : '',
    className ?? '',
  ].join(' ');

  const decoSize = size * (deco?.scale ?? 1.5);
  const decoClass = [
    styles.deco,
    deco?.animated ? styles.decoAnim : '',
    deco?.anim ? ANIM_CLASS[deco.anim] : '',
  ].join(' ');

  return (
    <span className={classes} style={wrapStyle}>
      <span className={styles.inner}>
        {avatarUrl
          // eslint-disable-next-line @next/next/no-img-element -- аватар из пользовательского upload, оптимизация next/image не нужна
          ? <img src={avatarUrl} alt={username ?? ''} className={styles.img} />
          : <span className={styles.initial} style={{ fontSize: Math.max(10, size * 0.42) }}>{initial}</span>}
      </span>
      {deco?.image && (
        // eslint-disable-next-line @next/next/no-img-element -- декоративный PNG-оверлей из public/
        <img
          src={deco.image}
          alt=""
          aria-hidden="true"
          className={decoClass}
          style={{ width: decoSize, height: decoSize }}
        />
      )}
    </span>
  );
}
