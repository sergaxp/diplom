import { CSSProperties, HTMLAttributes } from 'react';
import styles from './Skeleton.module.scss';

export interface SkeletonProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  width?: number | string;
  height?: number | string;
  circle?: boolean;
  /** Шорткат для текстовой строки (фикс высоты, скруглённые углы). */
  text?: boolean;
}

export function Skeleton({ width, height, circle, text, className, style, ...rest }: SkeletonProps) {
  const cls = [
    styles.skeleton,
    circle && styles.circle,
    text && styles.text,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const inline: CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    ...style,
  };

  return <span className={cls} style={inline} aria-hidden="true" {...rest} />;
}
