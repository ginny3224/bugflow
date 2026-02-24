'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface GlassTabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export function GlassTabs({
  tabs,
  activeTab,
  onChange,
  className,
}: GlassTabsProps) {
  return (
    <div
      className={cn('inline-flex items-center p-1 gap-0.5', className)}
      style={{
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '14px',
      }}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative inline-flex items-center gap-1.5 px-3 py-1.5',
              'text-sm font-medium rounded-[10px]',
              'transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
              'z-10 select-none',
            )}
            style={{
              color: isActive
                ? 'rgba(255, 255, 255, 0.95)'
                : 'rgba(255, 255, 255, 0.45)',
            }}
          >
            {/* Sliding indicator rendered behind content */}
            {isActive && (
              <motion.span
                layoutId="glass-tab-indicator"
                className="absolute inset-0 rounded-[10px]"
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                }}
                transition={{
                  type: 'spring',
                  stiffness: 400,
                  damping: 35,
                }}
              />
            )}

            {tab.icon !== undefined && (
              <span className="relative z-10 flex items-center shrink-0">
                {tab.icon}
              </span>
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
