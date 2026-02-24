'use client';

import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectOption {
  value: string;
  label: string;
}

interface GlassSelectProps {
  label?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}

export function GlassSelect({
  label,
  options,
  value,
  onChange,
  className,
  disabled = false,
  placeholder,
}: GlassSelectProps) {
  const id = useId();

  return (
    <div className={cn('flex flex-col gap-1.5 w-full', className)}>
      {label !== undefined && (
        <label
          htmlFor={id}
          className="text-sm font-medium select-none"
          style={{ color: 'rgba(255, 255, 255, 0.7)' }}
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn(
            'w-full h-10 pl-3 pr-9 rounded-xl text-sm appearance-none',
            'transition-all duration-200',
            'focus:outline-none',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            '[&>option]:bg-[#0a0a0f]',
          )}
          style={{
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: value ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.35)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.border = '1px solid rgba(10, 132, 255, 0.5)';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(10, 132, 255, 0.12)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {placeholder !== undefined && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Custom chevron icon */}
        <div
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
          style={{ color: 'rgba(255, 255, 255, 0.4)' }}
        >
          <ChevronDown size={15} strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}
