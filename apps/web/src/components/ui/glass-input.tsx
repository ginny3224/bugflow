'use client';

import { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';

interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  className?: string;
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ label, error, className, id: providedId, ...props }, ref) => {
    const generatedId = useId();
    const inputId = providedId ?? generatedId;

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
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full h-10 px-3 rounded-xl text-sm',
            'transition-all duration-200',
            'placeholder:text-white/30',
            'focus:outline-none',
            'disabled:opacity-40 disabled:cursor-not-allowed',
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
            // Focus ring is handled via CSS custom properties — the inline
            // style needs to be augmented with a focus class below.
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

GlassInput.displayName = 'GlassInput';
