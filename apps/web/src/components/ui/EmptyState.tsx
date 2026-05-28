import { ReactNode } from 'react';
import styles from './EmptyState.module.scss';

export type EmptyStateSize = 'sm' | 'md' | 'lg';

export interface EmptyStateProps {
  /** Иконка из lucide-react. Размер: 48px. */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Кнопка действия (обычно <Button> из ui). */
  action?: ReactNode;
  size?: EmptyStateSize;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  size = 'md',
  className,
}: EmptyStateProps) {
  return (
    <div className={[styles.root, styles[`size-${size}`], className].filter(Boolean).join(' ')}>
      {icon && <span className={styles.icon}>{icon}</span>}
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
