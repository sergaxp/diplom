import { HTMLAttributes, ReactNode } from 'react';
import styles from './Badge.module.scss';

export type BadgeVariant =
  | 'neutral'
  | 'brand'
  | 'accent'
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'rank-1'
  | 'rank-2'
  | 'rank-3'
  | 'rank-4';

export type BadgeShape = 'rounded' | 'pill';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  shape?: BadgeShape;
  outline?: boolean;
  children?: ReactNode;
}

export function Badge({
  variant = 'neutral',
  shape = 'rounded',
  outline = false,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={[
        styles.badge,
        styles[`variant-${variant}`],
        styles[`shape-${shape}`],
        outline && styles.outline,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </span>
  );
}
