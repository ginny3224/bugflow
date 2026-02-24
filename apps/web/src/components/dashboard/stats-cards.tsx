'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { Bug, Clock, CheckCircle, Radio, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { GlassCard, PlatformIcon, platformName } from '@/components/ui';

export interface ChannelStatus {
  platform: string;
  connected: boolean;
}

export interface DashboardStats {
  totalBugs: number;
  pendingReview: number;
  approvedToday: number;
  activeChannels: number;
  channels: ChannelStatus[];
  trends: {
    totalBugsDelta: number;
    pendingReviewDelta: number;
    approvedTodayDelta: number;
  };
}

interface AnimatedNumberProps {
  value: number;
  duration?: number;
}

function AnimatedNumber({ value, duration = 1.2 }: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;

    let startTime: number | null = null;
    const startValue = 0;
    const endValue = value;

    function animate(timestamp: number) {
      if (startTime === null) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(startValue + (endValue - startValue) * eased));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);
  }, [inView, value, duration]);

  return <span ref={ref}>{displayValue.toLocaleString()}</span>;
}

interface TrendIndicatorProps {
  delta: number;
  suffix?: string;
}

function TrendIndicator({ delta, suffix = 'from yesterday' }: TrendIndicatorProps) {
  if (delta === 0) {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs"
        style={{ color: 'var(--glass-text-secondary)' }}
      >
        <Minus size={11} />
        No change {suffix}
      </span>
    );
  }

  const isPositive = delta > 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const color = isPositive ? '#30d158' : '#ff453a';

  return (
    <span className="inline-flex items-center gap-1 text-xs" style={{ color }}>
      <Icon size={11} />
      {isPositive ? '+' : ''}{delta} {suffix}
    </span>
  );
}

const cardConfig = [
  {
    key: 'totalBugs' as const,
    label: 'Total Bugs',
    icon: Bug,
    iconColor: '#0a84ff',
    iconBg: 'rgba(10, 132, 255, 0.15)',
    deltaKey: 'totalBugsDelta' as const,
  },
  {
    key: 'pendingReview' as const,
    label: 'Pending Review',
    icon: Clock,
    iconColor: '#ff9f0a',
    iconBg: 'rgba(255, 159, 10, 0.15)',
    deltaKey: 'pendingReviewDelta' as const,
  },
  {
    key: 'approvedToday' as const,
    label: 'Approved Today',
    icon: CheckCircle,
    iconColor: '#30d158',
    iconBg: 'rgba(48, 209, 88, 0.15)',
    deltaKey: 'approvedTodayDelta' as const,
  },
];

interface StatsCardsProps {
  stats: DashboardStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const connectedCount = stats.channels.filter((c) => c.connected).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cardConfig.map((card, i) => {
        const Icon = card.icon;
        const count = stats[card.key];
        const delta = stats.trends[card.deltaKey];

        return (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.08, ease: 'easeOut' }}
          >
            <GlassCard className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
                  style={{
                    background: card.iconBg,
                    border: `1px solid ${card.iconColor}30`,
                  }}
                >
                  <Icon size={18} style={{ color: card.iconColor }} />
                </div>
              </div>

              <div className="space-y-1">
                <p
                  className="text-3xl font-bold tracking-tight tabular-nums"
                  style={{ color: 'var(--glass-text-primary)' }}
                >
                  <AnimatedNumber value={count} />
                </p>
                <p
                  className="text-sm font-medium"
                  style={{ color: 'var(--glass-text-secondary)' }}
                >
                  {card.label}
                </p>
              </div>

              <div className="mt-3">
                <TrendIndicator delta={delta} />
              </div>
            </GlassCard>
          </motion.div>
        );
      })}

      {/* Active Channels card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 3 * 0.08, ease: 'easeOut' }}
      >
        <GlassCard className="p-5 h-full">
          <div className="flex items-start justify-between mb-4">
            <div
              className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
              style={{
                background: 'rgba(191, 90, 242, 0.15)',
                border: '1px solid rgba(191, 90, 242, 0.3)',
              }}
            >
              <Radio size={18} style={{ color: '#bf5af2' }} />
            </div>
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{
                background:
                  connectedCount === stats.channels.length
                    ? 'rgba(48, 209, 88, 0.12)'
                    : 'rgba(255, 159, 10, 0.12)',
                color:
                  connectedCount === stats.channels.length
                    ? '#30d158'
                    : '#ff9f0a',
                border:
                  connectedCount === stats.channels.length
                    ? '1px solid rgba(48, 209, 88, 0.3)'
                    : '1px solid rgba(255, 159, 10, 0.3)',
              }}
            >
              {connectedCount}/{stats.channels.length}
            </span>
          </div>

          <p
            className="text-sm font-medium mb-3"
            style={{ color: 'var(--glass-text-secondary)' }}
          >
            Channels
          </p>

          <div className="flex flex-col gap-2">
            {stats.channels.map((ch) => (
              <div key={ch.platform} className="flex items-center gap-2.5">
                <PlatformIcon platform={ch.platform} size={14} />
                <span
                  className="text-xs font-medium flex-1"
                  style={{ color: 'var(--glass-text-secondary)' }}
                >
                  {platformName(ch.platform)}
                </span>
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      background: ch.connected ? '#30d158' : '#ff453a',
                      boxShadow: ch.connected
                        ? '0 0 6px rgba(48, 209, 88, 0.4)'
                        : 'none',
                    }}
                  />
                  <span
                    className="text-xs"
                    style={{
                      color: ch.connected
                        ? 'rgba(48, 209, 88, 0.8)'
                        : 'rgba(255, 69, 58, 0.8)',
                    }}
                  >
                    {ch.connected ? 'Connected' : 'Offline'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
