'use client';

import { cn } from '@/lib/utils';

type BadgeVariant = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'default';

interface GlassBadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  pulse?: boolean;
}

const variantConfig: Record<
  BadgeVariant,
  { color: string; bg: string; border: string; dot: string }
> = {
  critical: {
    color: '#ff453a',
    bg: 'rgba(255, 69, 58, 0.15)',
    border: 'rgba(255, 69, 58, 0.3)',
    dot: '#ff453a',
  },
  high: {
    color: '#ff9f0a',
    bg: 'rgba(255, 159, 10, 0.15)',
    border: 'rgba(255, 159, 10, 0.3)',
    dot: '#ff9f0a',
  },
  medium: {
    color: '#ffd60a',
    bg: 'rgba(255, 214, 10, 0.12)',
    border: 'rgba(255, 214, 10, 0.3)',
    dot: '#ffd60a',
  },
  low: {
    color: '#30d158',
    bg: 'rgba(48, 209, 88, 0.12)',
    border: 'rgba(48, 209, 88, 0.3)',
    dot: '#30d158',
  },
  info: {
    color: '#0a84ff',
    bg: 'rgba(10, 132, 255, 0.15)',
    border: 'rgba(10, 132, 255, 0.3)',
    dot: '#0a84ff',
  },
  default: {
    color: 'rgba(255, 255, 255, 0.6)',
    bg: 'rgba(255, 255, 255, 0.07)',
    border: 'rgba(255, 255, 255, 0.15)',
    dot: 'rgba(255, 255, 255, 0.4)',
  },
};

export function GlassBadge({
  variant = 'default',
  children,
  className,
  pulse = false,
}: GlassBadgeProps) {
  const config = variantConfig[variant];
  const showPulse = pulse || variant === 'critical';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5',
        'text-xs font-semibold rounded-full',
        'whitespace-nowrap select-none',
        className,
      )}
      style={{
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        background: config.bg,
        border: `1px solid ${config.border}`,
        color: config.color,
      }}
    >
      {showPulse && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span
            className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
            style={{ background: config.dot }}
          />
          <span
            className="relative inline-flex h-1.5 w-1.5 rounded-full"
            style={{ background: config.dot }}
          />
        </span>
      )}
      {children}
    </span>
  );
}
