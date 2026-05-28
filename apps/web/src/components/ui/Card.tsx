'use client';

import { forwardRef, HTMLAttributes, ButtonHTMLAttributes, ReactNode, CSSProperties } from 'react';
import styles from './Card.module.scss';

export type CardVariant = 'default' | 'elevated' | 'interactive';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CommonProps {
  variant?: CardVariant;
  padding?: CardPadding;
  /** Цвет полоски слева (ранг достижения, приоритет задачи). */
  stripeColor?: string;
  className?: string;
  children?: ReactNode;
  style?: CSSProperties;
}

type CardAsDiv = CommonProps &
  Omit<HTMLAttributes<HTMLDivElement>, keyof CommonProps> & {
    interactive?: false;
  };

type CardAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & {
    interactive: true;
  };

export type CardProps = CardAsDiv | CardAsButton;

function classes(
  variant: CardVariant,
  padding: CardPadding,
  hasStripe: boolean,
  extra?: string,
) {
  return [
    styles.card,
    styles[`variant-${variant}`],
    styles[`padding-${padding}`],
    hasStripe && styles.withStripe,
    extra,
  ]
    .filter(Boolean)
    .join(' ');
}

export const Card = forwardRef<HTMLDivElement | HTMLButtonElement, CardProps>(function Card(
  props,
  ref,
) {
  const {
    variant = 'default',
    padding = 'md',
    stripeColor,
    className,
    style,
    children,
    ...rest
  } = props;

  const hasStripe = Boolean(stripeColor);
  const cls = classes(variant, padding, hasStripe, className);

  const combinedStyle: CSSProperties = hasStripe
    ? { ...style, ['--stripe-color' as string]: stripeColor }
    : style ?? {};

  if ('interactive' in rest && rest.interactive) {
    const { interactive, ...buttonRest } = rest;
    void interactive;
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        className={cls}
        style={combinedStyle}
        {...(buttonRest as ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {children}
      </button>
    );
  }

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      className={cls}
      style={combinedStyle}
      {...(rest as HTMLAttributes<HTMLDivElement>)}
    >
      {children}
    </div>
  );
});
