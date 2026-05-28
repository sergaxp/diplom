'use client';

import { forwardRef, ReactNode } from 'react';
import { Button, ButtonProps, ButtonVariant, ButtonSize } from './Button';

export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'leftIcon' | 'rightIcon' | 'iconOnly' | 'fullWidth'> {
  /** Иконка (обычно из lucide-react). */
  icon: ReactNode;
  /** Обязательно для доступности. */
  'aria-label': string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const IconButton = forwardRef<HTMLButtonElement | HTMLAnchorElement, IconButtonProps>(
  function IconButton({ icon, variant = 'ghost', size = 'md', ...rest }, ref) {
    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        iconOnly
        {...(rest as ButtonProps)}
      >
        {icon}
      </Button>
    );
  },
);
