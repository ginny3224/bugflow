import { cn } from '@/lib/utils';

type AvatarSize = 'sm' | 'md' | 'lg';
type AvatarShape = 'circle' | 'rounded';

interface GlassAvatarProps {
  src?: string;
  name: string;
  size?: AvatarSize;
  shape?: AvatarShape;
  className?: string;
}

const sizeConfig: Record<AvatarSize, { px: number; textClass: string }> = {
  sm: { px: 32, textClass: 'text-xs font-semibold' },
  md: { px: 40, textClass: 'text-sm font-semibold' },
  lg: { px: 56, textClass: 'text-base font-bold' },
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0]?.[0] ?? '?').toUpperCase();
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

// Deterministic pastel color based on name hash
function getAvatarColor(name: string): string {
  const colors = [
    'rgba(10, 132, 255, 0.35)',   // blue
    'rgba(48, 209, 88, 0.3)',     // green
    'rgba(255, 159, 10, 0.3)',    // orange
    'rgba(191, 90, 242, 0.3)',    // purple
    'rgba(255, 69, 58, 0.3)',     // red
    'rgba(100, 210, 255, 0.3)',   // teal
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return colors[hash % colors.length] as string;
}

export function GlassAvatar({
  src,
  name,
  size = 'md',
  shape = 'circle',
  className,
}: GlassAvatarProps) {
  const { px, textClass } = sizeConfig[size];
  const initials = getInitials(name);
  const bg = getAvatarColor(name);
  const borderRadius = shape === 'circle' ? '50%' : '10px';

  return (
    <div
      className={cn('relative shrink-0 overflow-hidden select-none', className)}
      style={{
        width: px,
        height: px,
        borderRadius,
        border: '1px solid rgba(255, 255, 255, 0.15)',
        background: bg,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      title={name}
      aria-label={name}
    >
      {src !== undefined ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => {
            // Hide broken image to reveal initials fallback
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : null}
      {/* Initials fallback (always rendered; sits behind image) */}
      <span
        className={cn(
          'absolute inset-0 flex items-center justify-center',
          textClass,
        )}
        style={{ color: 'rgba(255, 255, 255, 0.9)' }}
      >
        {initials}
      </span>
    </div>
  );
}
