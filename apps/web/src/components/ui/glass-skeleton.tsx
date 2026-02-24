import { cn } from '@/lib/utils';

type RoundedVariant = 'sm' | 'md' | 'lg' | 'full';

interface GlassSkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: RoundedVariant;
}

const roundedClasses: Record<RoundedVariant, string> = {
  sm: 'rounded',
  md: 'rounded-lg',
  lg: 'rounded-xl',
  full: 'rounded-full',
};

export function GlassSkeleton({
  className,
  width,
  height,
  rounded = 'md',
}: GlassSkeletonProps) {
  return (
    <div
      className={cn(
        'glass-skeleton-shimmer',
        roundedClasses[rounded],
        className,
      )}
      style={{
        width: width !== undefined ? (typeof width === 'number' ? `${width}px` : width) : undefined,
        height: height !== undefined ? (typeof height === 'number' ? `${height}px` : height) : undefined,
        background: 'rgba(255, 255, 255, 0.06)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        backgroundImage:
          'linear-gradient(90deg, rgba(255,255,255,0.00) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.00) 100%)',
        backgroundSize: '200% 100%',
        animation: 'glass-shimmer 1.6s ease-in-out infinite',
      }}
      aria-hidden="true"
    />
  );
}

// Inject keyframes once — append to document head at module load time (client only)
// For SSR-safe usage the animation is defined in globals.css instead.
// If you prefer to keep it self-contained, add the keyframe via a style tag on first mount.
// The recommended approach is to add this to globals.css:
//
//   @keyframes glass-shimmer {
//     0%   { background-position: 200% 0; }
//     100% { background-position: -200% 0; }
//   }
//
// This component assumes that keyframe is present in the stylesheet.
