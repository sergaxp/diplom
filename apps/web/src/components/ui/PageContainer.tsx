import { HTMLAttributes, ReactNode } from 'react';
import styles from './PageContainer.module.scss';

export type PageContainerVariant = 'narrow' | 'wide' | 'full';
export type PageContainerPadding = 'none' | 'sm' | 'md' | 'lg';

export interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  variant?: PageContainerVariant;
  padding?: PageContainerPadding;
  as?: 'div' | 'main' | 'section' | 'article';
  children?: ReactNode;
}

export function PageContainer({
  variant = 'wide',
  padding = 'md',
  as: Tag = 'div',
  className,
  children,
  ...rest
}: PageContainerProps) {
  return (
    <Tag
      className={[
        styles.container,
        styles[`variant-${variant}`],
        styles[`padding-${padding}`],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </Tag>
  );
}
