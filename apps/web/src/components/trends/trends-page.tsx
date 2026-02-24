'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, TrendingUp, BarChart2, PieChart } from 'lucide-react';
import { GlassPanel, GlassBadge, GlassCard, PlatformIcon, platformName, platformColor } from '@/components/ui';
import { useRealtimeAlerts } from '@/lib/hooks/use-realtime';
import type { TrendAlert } from '@/lib/hooks/use-realtime';

interface TrendDataPoint {
  date: string;
  count: number;
}

interface CategoryBreakdown {
  category: string;
  count: number;
}

interface ChannelBreakdown {
  channel: string;
  count: number;
}

export interface TrendsData {
  dailyCounts: TrendDataPoint[];
  categoryBreakdown: CategoryBreakdown[];
  channelBreakdown: ChannelBreakdown[];
}

interface TrendsPageProps {
  teamId: string;
  data: TrendsData;
  initialAlerts: TrendAlert[];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function MiniBarChart({ data }: { data: TrendDataPoint[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const recent = data.slice(-30);

  return (
    <div className="flex items-end gap-0.5 h-24">
      {recent.map((point, i) => {
        const height = Math.max((point.count / max) * 100, 2);
        const isLast = i === recent.length - 1;

        return (
          <motion.div
            key={point.date}
            className="flex-1 rounded-t-sm min-w-[2px]"
            style={{
              background: isLast
                ? 'rgba(10,132,255,0.8)'
                : 'rgba(10,132,255,0.35)',
            }}
            initial={{ height: 0 }}
            animate={{ height: `${height}%` }}
            transition={{ duration: 0.6, delay: i * 0.01, ease: 'easeOut' }}
            title={`${point.date}: ${point.count} bugs`}
          />
        );
      })}
    </div>
  );
}

function CategoryPieChart({ data }: { data: CategoryBreakdown[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const colors = ['#0a84ff', '#30d158', '#ff9f0a', '#ff453a', '#bf5af2', '#64d2ff'];

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
          No data yet
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {data.slice(0, 6).map((item, i) => {
        const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
        const color = colors[i % colors.length] as string;

        return (
          <div key={item.category} className="space-y-1">
            <div className="flex items-center justify-between">
              <span
                className="text-xs font-medium truncate"
                style={{ color: 'rgba(255,255,255,0.7)' }}
              >
                {item.category || 'Uncategorized'}
              </span>
              <div className="flex items-center gap-2">
                <span
                  className="text-xs tabular-nums"
                  style={{ color: 'rgba(255,255,255,0.45)' }}
                >
                  {item.count}
                </span>
                <span
                  className="text-xs font-semibold tabular-nums w-8 text-right"
                  style={{ color }}
                >
                  {pct}%
                </span>
              </div>
            </div>
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: color }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: i * 0.05 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChannelBarChart({ data }: { data: ChannelBreakdown[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
          No data yet
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((item, i) => {
        const pct = Math.round((item.count / max) * 100);
        const color = platformColor(item.channel);

        return (
          <div key={item.channel} className="space-y-1">
            <div className="flex items-center justify-between">
              <span
                className="inline-flex items-center gap-1.5 text-xs font-medium"
                style={{ color: 'rgba(255,255,255,0.7)' }}
              >
                <PlatformIcon platform={item.channel} size={13} />
                {platformName(item.channel)}
              </span>
              <span
                className="text-xs tabular-nums font-semibold"
                style={{ color: 'rgba(255,255,255,0.6)' }}
              >
                {item.count}
              </span>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: color, opacity: 0.8 }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: i * 0.07 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TrendsPage({ teamId, data, initialAlerts }: TrendsPageProps) {
  const { alerts: liveAlerts } = useRealtimeAlerts(teamId);
  const alerts = liveAlerts.length > 0 ? liveAlerts : initialAlerts;

  const totalLast30 = data.dailyCounts
    .slice(-30)
    .reduce((s, d) => s + d.count, 0);

  const last7 = data.dailyCounts.slice(-7).reduce((s, d) => s + d.count, 0);
  const prev7 = data.dailyCounts
    .slice(-14, -7)
    .reduce((s, d) => s + d.count, 0);

  const weekDelta = last7 - prev7;

  return (
    <div className="space-y-6">
      {/* Summary row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: 'Last 30 Days',
            value: totalLast30,
            icon: TrendingUp,
            color: '#0a84ff',
          },
          {
            label: 'Last 7 Days',
            value: last7,
            icon: BarChart2,
            color: '#30d158',
            delta: weekDelta,
          },
          {
            label: 'Active Alerts',
            value: alerts.length,
            icon: AlertTriangle,
            color: alerts.length > 0 ? '#ff453a' : '#30d158',
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <GlassCard key={stat.label} className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${stat.color}20` }}
                >
                  <Icon size={17} style={{ color: stat.color }} />
                </div>
                <span
                  className="text-sm"
                  style={{ color: 'rgba(255,255,255,0.55)' }}
                >
                  {stat.label}
                </span>
              </div>
              <p
                className="text-3xl font-bold tabular-nums"
                style={{ color: 'rgba(255,255,255,0.95)' }}
              >
                {stat.value}
              </p>
              {stat.delta !== undefined && (
                <p
                  className="text-xs mt-1"
                  style={{
                    color:
                      stat.delta > 0
                        ? '#ff453a'
                        : stat.delta < 0
                        ? '#30d158'
                        : 'rgba(255,255,255,0.35)',
                  }}
                >
                  {stat.delta > 0 ? '+' : ''}
                  {stat.delta} vs previous week
                </p>
              )}
            </GlassCard>
          );
        })}
      </div>

      {/* Spike alerts */}
      {alerts.length > 0 && (
        <GlassPanel
          title="Spike Alerts"
          actions={
            <GlassBadge variant="critical" pulse>
              {alerts.length} active
            </GlassBadge>
          }
        >
          <div className="space-y-3">
            {alerts.map((alert) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-start gap-3 p-3 rounded-xl"
                style={{
                  background: 'rgba(255,69,58,0.06)',
                  border: '1px solid rgba(255,69,58,0.15)',
                }}
              >
                <AlertTriangle
                  size={15}
                  className="shrink-0 mt-0.5"
                  style={{ color: '#ff453a' }}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium"
                    style={{ color: 'rgba(255,255,255,0.85)' }}
                  >
                    {alert.message}
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: 'rgba(255,255,255,0.4)' }}
                  >
                    {timeAgo(alert.created_at)}
                  </p>
                </div>
                <GlassBadge
                  variant={alert.severity as 'critical' | 'high' | 'medium' | 'low'}
                >
                  {alert.severity}
                </GlassBadge>
              </motion.div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bug count over time */}
        <div className="lg:col-span-2">
          <GlassPanel title="Bug Volume (Last 30 Days)">
            {data.dailyCounts.length === 0 ? (
              <div className="flex items-center justify-center h-24">
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  No data yet
                </p>
              </div>
            ) : (
              <div>
                <MiniBarChart data={data.dailyCounts} />
                <div
                  className="flex justify-between mt-2"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                >
                  <span className="text-xs">30 days ago</span>
                  <span className="text-xs">Today</span>
                </div>
              </div>
            )}
          </GlassPanel>
        </div>

        {/* Category breakdown */}
        <GlassPanel title="By Category">
          <CategoryPieChart data={data.categoryBreakdown} />
        </GlassPanel>
      </div>

      {/* Channel distribution */}
      <GlassPanel title="Channel Distribution">
        {data.channelBreakdown.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
              No channel data yet
            </p>
          </div>
        ) : (
          <div className="max-w-lg">
            <ChannelBarChart data={data.channelBreakdown} />
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
