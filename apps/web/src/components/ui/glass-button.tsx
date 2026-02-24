'use client';

import { motion, type HTMLMotionProps, type TargetAndTransition } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/lib/theme-context';

type ButtonVariant = 'default' | 'primary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface GlassButtonProps
  extends Omit<HTMLMotionProps<'button'>, 'children' | 'size'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

const darkVariantStyles: Record<ButtonVariant, React.CSSProperties> = {
  default: {
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    color: 'rgba(255, 255, 255, 0.95)',
  },
  primary: {
    background: 'rgba(10, 132, 255, 0.25)',
    border: '1px solid rgba(10, 132, 255, 0.5)',
    color: '#ffffff',
  },
  danger: {
    background: 'rgba(255, 69, 58, 0.2)',
    border: '1px solid rgba(255, 69, 58, 0.45)',
    color: '#ff453a',
  },
  ghost: {
    background: 'transparent',
    border: '1px solid transparent',
    color: 'rgba(255, 255, 255, 0.7)',
  },
};

const lightVariantStyles: Record<ButtonVariant, React.CSSProperties> = {
  default: {
    background: 'rgba(0, 0, 0, 0.05)',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    color: 'rgba(0, 0, 0, 0.85)',
  },
  primary: {
    background: 'rgba(10, 132, 255, 0.15)',
    border: '1px solid rgba(10, 132, 255, 0.4)',
    color: '#0a84ff',
  },
  danger: {
    background: 'rgba(255, 69, 58, 0.12)',
    border: '1px solid rgba(255, 69, 58, 0.35)',
    color: '#ff453a',
  },
  ghost: {
    background: 'transparent',
    border: '1px solid transparent',
    color: 'rgba(0, 0, 0, 0.6)',
  },
};

const darkHoverStyles: Record<ButtonVariant, TargetAndTransition> = {
  default: {
    background: 'rgba(255, 255, 255, 0.13)',
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  primary: {
    background: 'rgba(10, 132, 255, 0.38)',
    borderColor: 'rgba(10, 132, 255, 0.7)',
  },
  danger: {
    background: 'rgba(255, 69, 58, 0.3)',
    borderColor: 'rgba(255, 69, 58, 0.6)',
  },
  ghost: {
    background: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
};

const lightHoverStyles: Record<ButtonVariant, TargetAndTransition> = {
  default: {
    background: 'rgba(0, 0, 0, 0.08)',
    borderColor: 'rgba(0, 0, 0, 0.18)',
  },
  primary: {
    background: 'rgba(10, 132, 255, 0.25)',
    borderColor: 'rgba(10, 132, 255, 0.6)',
  },
  danger: {
    background: 'rgba(255, 69, 58, 0.2)',
    borderColor: 'rgba(255, 69, 58, 0.5)',
  },
  ghost: {
    background: 'rgba(0, 0, 0, 0.04)',
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2.5',
};

const iconSizes: Record<ButtonSize, number> = {
  sm: 12,
  md: 14,
  lg: 16,
};

export function GlassButton({
  variant = 'default',
  size = 'md',
  children,
  className,
  disabled = false,
  loading = false,
  type = 'button',
  onClick,
  ...props
}: GlassButtonProps) {
  const isDisabled = disabled || loading;
  const { theme } = useTheme();
  const variantStyles = theme === 'light' ? lightVariantStyles : darkVariantStyles;
  const variantHoverStyles = theme === 'light' ? lightHoverStyles : darkHoverStyles;

  return (
    <motion.button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-xl',
        'transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
        'select-none',
        sizeClasses[size],
        isDisabled && 'opacity-40 cursor-not-allowed pointer-events-none',
        className,
      )}
      style={{
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        ...variantStyles[variant],
      }}
      whileHover={!isDisabled ? variantHoverStyles[variant] : undefined}
      whileTap={!isDisabled ? { scale: 0.97 } : undefined}
      initial={false}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      {...props}
    >
      {loading ? (
        <Loader2
          size={iconSizes[size]}
          className="animate-spin shrink-0"
        />
      ) : null}
      {children}
    </motion.button>
  );
}
