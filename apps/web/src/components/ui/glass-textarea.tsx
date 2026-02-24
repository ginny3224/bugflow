'use client';

import { forwardRef, useId, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface GlassTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  className?: string;
  rows?: number;
  autoResize?: boolean;
}

export const GlassTextarea = forwardRef<
  HTMLTextAreaElement,
  GlassTextareaProps
>(
  (
    {
      label,
      error,
      className,
      rows = 4,
      autoResize = false,
      id: providedId,
      onChange,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = providedId ?? generatedId;
    const internalRef = useRef<HTMLTextAreaElement | null>(null);

    const setRefs = useCallback(
      (el: HTMLTextAreaElement | null) => {
        internalRef.current = el;
        if (typeof ref === 'function') {
          ref(el);
        } else if (ref) {
          ref.current = el;
        }
      },
      [ref],
    );

    const resize = useCallback(() => {
      const el = internalRef.current;
      if (el && autoResize) {
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
      }
    }, [autoResize]);

    // Initial resize on mount
    useEffect(() => {
      resize();
    }, [resize]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      resize();
      onChange?.(e);
    };

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label !== undefined && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium select-none"
            style={{ color: 'rgba(255, 255, 255, 0.7)' }}
          >
            {label}
          </label>
        )}
        <textarea
          ref={setRefs}
          id={inputId}
          rows={autoResize ? 1 : rows}
          onChange={handleChange}
          className={cn(
            'w-full px-3 py-2.5 rounded-xl text-sm',
            'transition-all duration-200',
            'placeholder:text-white/30',
            'focus:outline-none resize-none',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            autoResize && 'overflow-hidden',
            className,
          )}
          style={{
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            background: 'rgba(255, 255, 255, 0.05)',
            border: error
              ? '1px solid rgba(255, 69, 58, 0.6)'
              : '1px solid rgba(255, 255, 255, 0.1)',
            color: 'rgba(255, 255, 255, 0.95)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.border = error
              ? '1px solid rgba(255, 69, 58, 0.8)'
              : '1px solid rgba(10, 132, 255, 0.5)';
            e.currentTarget.style.boxShadow = error
              ? '0 0 0 3px rgba(255, 69, 58, 0.12)'
              : '0 0 0 3px rgba(10, 132, 255, 0.12)';
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            e.currentTarget.style.border = error
              ? '1px solid rgba(255, 69, 58, 0.6)'
              : '1px solid rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.boxShadow = 'none';
            props.onBlur?.(e);
          }}
          {...props}
        />
        {error !== undefined && (
          <p className="text-xs" style={{ color: '#ff453a' }}>
            {error}
          </p>
        )}
      </div>
    );
  },
);

GlassTextarea.displayName = 'GlassTextarea';
