'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  GitMerge,
  Clock,
  MessageSquare,
  Cpu,
  ArrowUpDown,
  Check,
} from 'lucide-react';
import {
  GlassCard,
  GlassBadge,
  GlassButton,
  PlatformIcon,
  platformName,
} from '@/components/ui';
import { useRealtimeQueue } from '@/lib/hooks/use-realtime';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { BugReport } from '@/lib/hooks/use-realtime';

type SortBy = 'newest' | 'oldest' | 'severity' | 'confidence';

const sortOptions: { value: SortBy; label: string }[] = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'severity', label: 'By Severity' },
  { value: 'confidence', label: 'By Confidence' },
];

const severityLevels = ['critical', 'high', 'medium', 'low'] as const;
const severityColors: Record<string, { color: string; bg: string; border: string }> = {
  critical: { color: '#ff453a', bg: 'rgba(255, 69, 58, 0.15)', border: 'rgba(255, 69, 58, 0.3)' },
  high: { color: '#ff9f0a', bg: 'rgba(255, 159, 10, 0.15)', border: 'rgba(255, 159, 10, 0.3)' },
  medium: { color: '#ffd60a', bg: 'rgba(255, 214, 10, 0.12)', border: 'rgba(255, 214, 10, 0.3)' },
  low: { color: '#30d158', bg: 'rgba(48, 209, 88, 0.12)', border: 'rgba(48, 209, 88, 0.3)' },
};

const sourceChannels = ['slack', 'discord', 'intercom', 'telegram'] as const;

const severityOrder: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface QueueItemProps {
  bug: BugReport;
  onAction: (id: string, action: 'approve' | 'reject' | 'merge') => Promise<void>;
}

function QueueItem({ bug, onAction }: QueueItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState<'approve' | 'reject' | 'merge' | null>(null);

  async function handleAction(action: 'approve' | 'reject' | 'merge') {
    setLoading(action);
    try {
      await onAction(bug.id, action);
    } finally {
      setLoading(null);
    }
  }

  const confidencePct = bug.confidence_score !== null
    ? Math.round(bug.confidence_score * 100)
    : null;

  return (
    <GlassCard hover className="p-0 overflow-hidden">
      {/* Header row */}
      <button
        className="w-full text-left p-5"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <GlassBadge variant={bug.severity as 'critical' | 'high' | 'medium' | 'low'}>
                {bug.severity}
              </GlassBadge>
              {bug.source_channel && (
                <span
                  className="inline-flex items-center gap-1 text-xs"
                  style={{ color: 'rgba(255,255,255,0.4)' }}
                >
                  <PlatformIcon platform={bug.source_channel} size={12} />
                  via {platformName(bug.source_channel)}
                </span>
              )}
              {bug.dedup_match_id && bug.match_details && (
                <GlassBadge variant="info">
                  {bug.match_details.type === 'monday'
                    ? 'Possible duplicate in Monday.com'
                    : 'Possible duplicate bug'}
                  {bug.dedup_score !== null && (
                    <span style={{ opacity: 0.7 }}>
                      {' '}· {Math.round(bug.dedup_score * 100)}% match
                    </span>
                  )}
                </GlassBadge>
              )}
              {bug.dedup_match_id && !bug.match_details && (
                <GlassBadge variant="info">Possible duplicate</GlassBadge>
              )}
            </div>
            <p
              className="text-sm font-medium"
              style={{ color: 'rgba(255,255,255,0.9)' }}
            >
              {bug.title}
            </p>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {confidencePct !== null && (
              <div className="text-right">
                <div
                  className="text-xs font-semibold tabular-nums"
                  style={{
                    color: confidencePct >= 80
                      ? '#30d158'
                      : confidencePct >= 60
                      ? '#ff9f0a'
                      : '#ff453a',
                  }}
                >
                  {confidencePct}%
                </div>
                <div
                  className="text-xs"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                >
                  confidence
                </div>
              </div>
            )}

            <div className="text-right">
              <div className="flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                <Clock size={11} />
                <span className="text-xs">{timeAgo(bug.created_at)}</span>
              </div>
            </div>

            <div style={{ color: 'rgba(255,255,255,0.4)' }}>
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </div>
        </div>
      </button>

      {/* Expanded details */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div
              className="px-5 pb-5 space-y-4"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
              {bug.description && (
                <div className="pt-4">
                  <p
                    className="text-xs font-medium mb-1.5 uppercase tracking-wide"
                    style={{ color: 'rgba(255,255,255,0.4)' }}
                  >
                    Description
                  </p>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: 'rgba(255,255,255,0.7)' }}
                  >
                    {bug.description}
                  </p>
                </div>
              )}

              {bug.steps_to_reproduce && (
                <div>
                  <p
                    className="text-xs font-medium mb-1.5 uppercase tracking-wide"
                    style={{ color: 'rgba(255,255,255,0.4)' }}
                  >
                    Steps to Reproduce
                  </p>
                  <p
                    className="text-sm leading-relaxed whitespace-pre-wrap"
                    style={{ color: 'rgba(255,255,255,0.7)' }}
                  >
                    {bug.steps_to_reproduce}
                  </p>
                </div>
              )}

              {bug.consolidated_summary && (
                <div
                  className="p-3 rounded-xl"
                  style={{
                    background: 'rgba(10,132,255,0.08)',
                    border: '1px solid rgba(10,132,255,0.2)',
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Cpu size={12} style={{ color: '#0a84ff' }} />
                    <p
                      className="text-xs font-medium"
                      style={{ color: '#0a84ff' }}
                    >
                      AI Summary
                    </p>
                  </div>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: 'rgba(255,255,255,0.7)' }}
                  >
                    {bug.consolidated_summary}
                  </p>
                </div>
              )}

              {bug.match_details && (
                <div
                  className="p-3 rounded-xl"
                  style={{
                    background: 'rgba(255,159,10,0.08)',
                    border: '1px solid rgba(255,159,10,0.2)',
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <GitMerge size={12} style={{ color: '#ff9f0a' }} />
                    <p
                      className="text-xs font-medium"
                      style={{ color: '#ff9f0a' }}
                    >
                      {bug.match_details.type === 'monday'
                        ? 'Similar Item in Monday.com'
                        : 'Similar Existing Bug Report'}
                      {bug.dedup_score !== null && (
                        <span style={{ opacity: 0.7, marginLeft: '4px' }}>
                          ({Math.round(bug.dedup_score * 100)}% similarity)
                        </span>
                      )}
                    </p>
                  </div>
                  <p
                    className="text-sm font-medium mb-1"
                    style={{ color: 'rgba(255,255,255,0.9)' }}
                  >
                    {bug.match_details.title}
                  </p>
                  {bug.match_details.description && (
                    <p
                      className="text-xs leading-relaxed"
                      style={{ color: 'rgba(255,255,255,0.6)' }}
                    >
                      {bug.match_details.description}
                    </p>
                  )}
                  {bug.match_details.type === 'monday' && bug.match_details.monday_board_id && (
                    <p
                      className="text-xs mt-1.5"
                      style={{ color: 'rgba(255,255,255,0.4)' }}
                    >
                      Board ID: {bug.match_details.monday_board_id}
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <GlassButton
                  variant="primary"
                  size="sm"
                  loading={loading === 'approve'}
                  disabled={loading !== null}
                  onClick={() => handleAction('approve')}
                >
                  <CheckCircle size={13} />
                  Approve
                </GlassButton>
                <GlassButton
                  variant="danger"
                  size="sm"
                  loading={loading === 'reject'}
                  disabled={loading !== null}
                  onClick={() => handleAction('reject')}
                >
                  <XCircle size={13} />
                  Reject
                </GlassButton>
                {bug.dedup_match_id && (
                  <GlassButton
                    size="sm"
                    loading={loading === 'merge'}
                    disabled={loading !== null}
                    onClick={() => handleAction('merge')}
                    style={{
                      background: 'rgba(10,132,255,0.15)',
                      borderColor: 'rgba(10,132,255,0.3)',
                      color: '#0a84ff',
                    }}
                  >
                    <GitMerge size={13} />
                    {bug.match_details?.type === 'monday'
                      ? 'Mark as Duplicate (in Monday.com)'
                      : 'Merge Duplicate'}
                  </GlassButton>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}

interface ReviewQueuePageProps {
  teamId: string;
  initialQueue: BugReport[];
}

export function ReviewQueuePage({ teamId, initialQueue }: ReviewQueuePageProps) {
  const { queue: liveQueue } = useRealtimeQueue(teamId);
  const [activeSeverities, setActiveSeverities] = useState<Set<string>>(new Set());
  const [activeSources, setActiveSources] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  // Close sort dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    }
    if (sortOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [sortOpen]);

  const items = liveQueue.length > 0 ? liveQueue : initialQueue;

  function toggleSeverity(s: string) {
    setActiveSeverities((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  function toggleSource(s: string) {
    setActiveSources((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  const filtered = items
    .filter((b) => activeSeverities.size === 0 || activeSeverities.has(b.severity))
    .filter((b) => activeSources.size === 0 || (b.source_channel && activeSources.has(b.source_channel)))
    .sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'severity':
          return (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4);
        case 'confidence':
          return (b.confidence_score ?? 0) - (a.confidence_score ?? 0);
        default: // newest
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  const activeFilterCount = activeSeverities.size + activeSources.size;

  const handleAction = useCallback(
    async (id: string, action: 'approve' | 'reject' | 'merge') => {
      const supabase = createClient();

      const statusMap = {
        approve: 'approved',
        reject: 'rejected',
        merge: 'rejected',
      } as const;

      const { error } = await supabase
        .from('bug_reports')
        .update({ status: statusMap[action], updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        toast.error('Failed to update bug report');
      } else {
        toast.success(
          action === 'approve'
            ? 'Bug approved'
            : action === 'reject'
            ? 'Bug rejected'
            : 'Duplicate merged',
        );
      }
    },
    [],
  );

  const currentSortLabel = sortOptions.find((o) => o.value === sortBy)?.label ?? 'Sort';

  return (
    <div className="space-y-4">
      {/* Filter & Sort Bar */}
      <div className="flex flex-col gap-3">
        {/* Top row: Sort button + Live indicator */}
        <div className="flex items-center gap-3">
          {/* Sort dropdown */}
          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setSortOpen((v) => !v)}
              className="inline-flex items-center gap-2 h-8 px-3 text-xs font-medium rounded-lg select-none transition-colors"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.7)',
              }}
            >
              <ArrowUpDown size={12} />
              {currentSortLabel}
              <ChevronDown size={11} style={{ opacity: 0.5 }} />
            </button>
            <AnimatePresence>
              {sortOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 top-full mt-1 z-50 min-w-[160px] rounded-xl overflow-hidden py-1"
                  style={{
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    background: 'rgba(30, 30, 35, 0.95)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                  }}
                >
                  {sortOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setSortBy(opt.value);
                        setSortOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors"
                      style={{
                        color: sortBy === opt.value ? '#0a84ff' : 'rgba(255,255,255,0.7)',
                        background: sortBy === opt.value ? 'rgba(10,132,255,0.1)' : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (sortBy !== opt.value) e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = sortBy === opt.value ? 'rgba(10,132,255,0.1)' : 'transparent';
                      }}
                    >
                      <span className="w-4 flex justify-center">
                        {sortBy === opt.value && <Check size={12} />}
                      </span>
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Separator */}
          <div className="h-4 w-px" style={{ background: 'rgba(255,255,255,0.08)' }} />

          {/* Source filter chips */}
          <div className="flex items-center gap-1.5">
            {sourceChannels.map((ch) => {
              const active = activeSources.has(ch);
              return (
                <button
                  key={ch}
                  onClick={() => toggleSource(ch)}
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-lg select-none transition-all"
                  style={{
                    background: active ? 'rgba(10,132,255,0.15)' : 'rgba(255,255,255,0.04)',
                    border: active
                      ? '1px solid rgba(10,132,255,0.35)'
                      : '1px solid rgba(255,255,255,0.08)',
                    color: active ? '#0a84ff' : 'rgba(255,255,255,0.45)',
                  }}
                >
                  <PlatformIcon platform={ch} size={12} />
                  <span className="hidden sm:inline">{platformName(ch)}</span>
                </button>
              );
            })}
          </div>

          {/* Separator */}
          <div className="h-4 w-px" style={{ background: 'rgba(255,255,255,0.08)' }} />

          {/* Severity filter chips */}
          <div className="flex items-center gap-1.5">
            {severityLevels.map((sev) => {
              const active = activeSeverities.has(sev);
              const colors = severityColors[sev];
              return (
                <button
                  key={sev}
                  onClick={() => toggleSeverity(sev)}
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-lg select-none transition-all capitalize"
                  style={{
                    background: active ? colors.bg : 'rgba(255,255,255,0.04)',
                    border: active
                      ? `1px solid ${colors.border}`
                      : '1px solid rgba(255,255,255,0.08)',
                    color: active ? colors.color : 'rgba(255,255,255,0.45)',
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: active ? colors.color : 'rgba(255,255,255,0.25)' }}
                  />
                  {sev}
                </button>
              );
            })}
          </div>

          {/* Clear filters + Live */}
          <div className="ml-auto flex items-center gap-3">
            {activeFilterCount > 0 && (
              <button
                onClick={() => {
                  setActiveSeverities(new Set());
                  setActiveSources(new Set());
                }}
                className="text-xs font-medium transition-colors"
                style={{ color: 'rgba(255,255,255,0.4)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
              >
                Clear filters
              </button>
            )}
            <div className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs">Live</span>
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <CheckCircle size={40} style={{ color: 'rgba(48,209,88,0.4)' }} />
          <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {activeFilterCount > 0 ? 'No matching bugs' : 'Queue is clear'}
          </p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {activeFilterCount > 0
              ? 'Try adjusting your filters'
              : 'No bug reports pending review'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((bug) => (
              <motion.div
                key={bug.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.2 }}
              >
                <QueueItem bug={bug} onAction={handleAction} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
