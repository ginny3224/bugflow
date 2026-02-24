'use client';

import { cn } from '@/lib/utils';

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  actions?: React.ReactNode;
}

export function GlassPanel({
  children,
  className,
  title,
  actions,
}: GlassPanelProps) {
  const hasHeader = title !== undefined || actions !== undefined;

  return (
    <div
      className={cn('flex flex-col', className)}
      style={{
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '20px',
      }}
    >
      {hasHeader && (
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          {title !== undefined && (
            <h2
              className="text-base font-semibold tracking-tight"
              style={{ color: 'rgba(255, 255, 255, 0.95)' }}
            >
              {title}
            </h2>
          )}
          {actions !== undefined && (
            <div className="flex items-center gap-2">{actions}</div>
          )}
        </div>
      )}
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
