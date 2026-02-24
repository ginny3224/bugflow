'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Bug, ArrowUpRight } from 'lucide-react';
import {
  GlassCard,
  GlassBadge,
  GlassInput,
  GlassTabs,
  PlatformIcon,
  platformName,
} from '@/components/ui';
import { useRealtimeBugs } from '@/lib/hooks/use-realtime';
import type { BugReport } from '@/lib/hooks/use-realtime';

type FilterTab = 'all' | 'pending_review' | 'approved' | 'created_in_monday';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'pending_review', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'created_in_monday', label: 'In Monday' },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface BugListPageProps {
  teamId: string;
  initialBugs: BugReport[];
}

export function BugListPage({ teamId, initialBugs }: BugListPageProps) {
  const router = useRouter();
  const { bugs: liveBugs } = useRealtimeBugs(teamId);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const bugs = liveBugs.length > 0 ? liveBugs : initialBugs;

  const filtered = useMemo(() => {
    let result = bugs;

    if (activeTab !== 'all') {
      result = result.filter((b) => b.status === activeTab);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.description?.toLowerCase().includes(q) ||
          b.category?.toLowerCase().includes(q),
      );
    }

    return result;
  }, [bugs, activeTab, search]);

  const counts = useMemo(
    () => ({
      all: bugs.length,
      pending_review: bugs.filter((b) => b.status === 'pending_review').length,
      approved: bugs.filter((b) => b.status === 'approved').length,
      created_in_monday: bugs.filter((b) => b.status === 'created_in_monday').length,
    }),
    [bugs],
  );

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center gap-4 flex-wrap">
        <GlassTabs
          tabs={TABS.map((t) => ({
            ...t,
            label: `${t.label} ${counts[t.id as FilterTab]}`,
          }))}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as FilterTab)}
        />
        <div className="flex-1 min-w-48 max-w-xs">
          <GlassInput
            placeholder="Search bugs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="ml-auto flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs">Live</span>
        </div>
      </div>

      {/* Table header */}
      {filtered.length > 0 && (
        <div
          className="grid grid-cols-[1fr_100px_120px_120px_80px_90px] gap-4 px-4 py-2"
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          <span className="text-xs font-medium uppercase tracking-wide">Title</span>
          <span className="text-xs font-medium uppercase tracking-wide">Severity</span>
          <span className="text-xs font-medium uppercase tracking-wide">Status</span>
          <span className="text-xs font-medium uppercase tracking-wide">Channel</span>
          <span className="text-xs font-medium uppercase tracking-wide text-center">Reports</span>
          <span className="text-xs font-medium uppercase tracking-wide text-right">Created</span>
        </div>
      )}

      {/* Bug rows */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Bug size={40} style={{ color: 'rgba(255,255,255,0.15)' }} />
          <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>
            No bugs found
          </p>
          {search && (
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Try adjusting your search or filter
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {filtered.map((bug, i) => (
              <motion.div
                key={bug.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.2) }}
              >
                <GlassCard
                  hover
                  className="p-0"
                  onClick={() => router.push(`/bugs/${bug.id}`)}
                >
                  <div className="grid grid-cols-[1fr_100px_120px_120px_80px_90px] gap-4 items-center px-4 py-3.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Bug size={14} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
                      <span
                        className="text-sm font-medium truncate"
                        style={{ color: 'rgba(255,255,255,0.85)' }}
                      >
                        {bug.title}
                      </span>
                      {bug.dedup_match_id && (
                        <GlassBadge variant="info">dup</GlassBadge>
                      )}
                    </div>

                    <div>
                      <GlassBadge
                        variant={bug.severity as 'critical' | 'high' | 'medium' | 'low'}
                      >
                        {bug.severity}
                      </GlassBadge>
                    </div>

                    <div>
                      <GlassBadge
                        variant={
                          bug.status === 'pending_review'
                            ? 'high'
                            : bug.status === 'approved'
                            ? 'low'
                            : bug.status === 'created_in_monday'
                            ? 'info'
                            : 'default'
                        }
                      >
                        {bug.status.replace(/_/g, ' ')}
                      </GlassBadge>
                    </div>

                    <div>
                      {bug.source_channel ? (
                        <span
                          className="inline-flex items-center gap-1.5 text-xs"
                          style={{ color: 'rgba(255,255,255,0.5)' }}
                        >
                          <PlatformIcon platform={bug.source_channel} size={13} />
                          {platformName(bug.source_channel)}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>—</span>
                      )}
                    </div>

                    <div className="text-center">
                      <span
                        className="text-sm tabular-nums font-medium"
                        style={{ color: 'rgba(255,255,255,0.7)' }}
                      >
                        {bug.report_count ?? 1}
                      </span>
                    </div>

                    <div className="flex items-center justify-end gap-1.5">
                      <span
                        className="text-xs"
                        style={{ color: 'rgba(255,255,255,0.35)' }}
                      >
                        {timeAgo(bug.created_at)}
                      </span>
                      <ArrowUpRight size={13} style={{ color: 'rgba(255,255,255,0.25)' }} />
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
