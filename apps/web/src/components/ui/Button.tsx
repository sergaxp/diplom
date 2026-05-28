'use client';

import { forwardRef, ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from 'react';
import Link from 'next/link';
import styles from './Button.module.scss';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  loading?: boolean;
  iconOnly?: boolean;
  children?: ReactNode;
  className?: string;
}

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & {
    href?: undefined;
  };

type ButtonAsLink = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps> & {
    href: string;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

const Spinner = () => <span className={styles.spinner} aria-hidden="true" />;

function classes(
  variant: ButtonVariant,
  size: ButtonSize,
  fullWidth: boolean,
  iconOnly: boolean,
  loading: boolean,
  extra?: string,
) {
  return [
    styles.btn,
    styles[`variant-${variant}`],
    styles[`size-${size}`],
    iconOnly && styles.iconOnly,
    fullWidth && styles.fullWidth,
    loading && styles.loading,
    extra,
  ]
    .filter(Boolean)
    .join(' ');
}

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  function Button(props, ref) {
    const {
      variant = 'secondary',
      size = 'md',
      leftIcon,
      rightIcon,
      fullWidth = false,
      iconOnly = false,
      loading = false,
      children,
      className,
      ...rest
    } = props;

    const cls = classes(variant, size, fullWidth, iconOnly, loading, className);

    const inner = loading ? (
      <>
        <Spinner />
        {!iconOnly && children}
      </>
    ) : (
      <>
        {leftIcon}
        {!iconOnly && children}
        {iconOnly && children}
        {rightIcon}
      </>
    );

    // Link variant
    if ('href' in rest && rest.href !== undefined) {
      const { href, ...anchorRest } = rest;
      return (
        <Link
          href={href}
          ref={ref as React.Ref<HTMLAnchorElement>}
          className={cls}
          {...anchorRest}
        >
          {inner}
        </Link>
      );
    }

    // Button variant
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type={(rest as ButtonHTMLAttributes<HTMLButtonElement>).type ?? 'button'}
        disabled={loading || (rest as ButtonHTMLAttributes<HTMLButtonElement>).disabled}
        className={cls}
        {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {inner}
      </button>
    );
  },
);
