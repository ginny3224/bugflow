'use client';

import { useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface GlassTooltipProps {
  content: string;
  children: React.ReactElement;
  position?: TooltipPosition;
  className?: string;
}

const positionStyles: Record<TooltipPosition, React.CSSProperties> = {
  top: {
    bottom: 'calc(100% + 8px)',
    left: '50%',
    transform: 'translateX(-50%)',
  },
  bottom: {
    top: 'calc(100% + 8px)',
    left: '50%',
    transform: 'translateX(-50%)',
  },
  left: {
    right: 'calc(100% + 8px)',
    top: '50%',
    transform: 'translateY(-50%)',
  },
  right: {
    left: 'calc(100% + 8px)',
    top: '50%',
    transform: 'translateY(-50%)',
  },
};

const entryOffset: Record<TooltipPosition, object> = {
  top: { y: 4, x: '-50%' },
  bottom: { y: -4, x: '-50%' },
  left: { x: 4, y: '-50%' },
  right: { x: -4, y: '-50%' },
};

const restOffset: Record<TooltipPosition, object> = {
  top: { y: 0, x: '-50%' },
  bottom: { y: 0, x: '-50%' },
  left: { x: 0, y: '-50%' },
  right: { x: 0, y: '-50%' },
};

export function GlassTooltip({
  content,
  children,
  position = 'top',
  className,
}: GlassTooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(true);
  };

  const hide = () => {
    timeoutRef.current = setTimeout(() => setVisible(false), 80);
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {/* Clone child to attach aria-describedby */}
      {children}

      <AnimatePresence>
        {visible && (
          <motion.div
            role="tooltip"
            className={cn(
              'absolute z-50 px-2.5 py-1.5 pointer-events-none',
              'text-xs font-medium whitespace-nowrap',
              className,
            )}
            style={{
              ...positionStyles[position],
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              background: 'rgba(30, 30, 40, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              color: 'rgba(255, 255, 255, 0.9)',
            }}
            initial={{ opacity: 0, ...entryOffset[position] }}
            animate={{ opacity: 1, ...restOffset[position] }}
            exit={{ opacity: 0, ...entryOffset[position] }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
