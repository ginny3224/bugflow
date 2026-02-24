'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useTheme } from '@/lib/theme-context';

interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'onClick'> {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function GlassCard({
  children,
  className,
  hover = false,
  onClick,
  ...props
}: GlassCardProps) {
  const isInteractive = hover || !!onClick;
  const { theme } = useTheme();
  const isLight = theme === 'light';

  return (
    <motion.div
      onClick={onClick}
      className={cn(
        'relative rounded-2xl p-6',
        isInteractive && 'cursor-pointer',
        className,
      )}
      style={{
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        background: isLight ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.05)',
        border: isLight ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        transition: 'background 0.3s ease, border-color 0.3s ease',
      }}
      whileHover={
        isInteractive
          ? {
              scale: 1.015,
              borderColor: isLight ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.2)',
              background: isLight ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.08)',
            }
          : undefined
      }
      whileTap={onClick ? { scale: 0.99 } : undefined}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
