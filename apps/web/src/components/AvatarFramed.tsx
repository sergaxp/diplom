'use client';

import { CSSProperties } from 'react';
import { getFrameColor } from '../lib/shop';
import styles from './AvatarFramed.module.scss';

interface Props {
  avatarUrl: string | null | undefined;
  displayName?: string | null;
  username?: string | null;
  frameId?: string | null;
  /** CSS pixel size of the avatar disk (without the frame ring). */
  size?: number;
  className?: string;
}

/**
 * Avatar with optional decorative ring around it. The ring is rendered as an outer
 * border whose color comes from FRAME_COLORS (see lib/shop.ts).
 */
export function AvatarFramed({
  avatarUrl,
  displayName,
  username,
  frameId,
  size = 32,
  className,
}: Props) {
  const initial =
    (displayName?.trim()?.[0] ?? username?.[0] ?? '?').toUpperCase();
  const frameColor = getFrameColor(frameId);
  const ring = frameColor ? Math.max(2, Math.round(size * 0.08)) : 0;

  const wrapStyle: CSSProperties = {
    width: size,
    height: size,
    padding: ring,
    background: frameColor
      ? `linear-gradient(135deg, ${frameColor}, ${frameColor}cc)`
      : 'transparent',
  };

  return (
    <span
      className={[styles.wrap, frameColor ? styles.wrapFramed : '', className ?? ''].join(' ')}
      style={wrapStyle}
    >
      <span className={styles.inner}>
        {avatarUrl
          ? <img src={avatarUrl} alt={username ?? ''} className={styles.img} />
          : <span className={styles.initial} style={{ fontSize: Math.max(10, size * 0.42) }}>{initial}</span>}
      </span>
    </span>
  );
}
