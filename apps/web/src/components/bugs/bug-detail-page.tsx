'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  XCircle,
  ExternalLink,
  ArrowUpCircle,
  MessageSquare,
  GitMerge,
  Cpu,
  Calendar,
  Hash,
} from 'lucide-react';
import {
  GlassPanel,
  GlassBadge,
  GlassButton,
  GlassSelect,
  PlatformIcon,
  platformName,
} from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { BugReport, IncomingMessage } from '@/lib/hooks/use-realtime';

interface BugDetailPageProps {
  bug: BugReport;
  linkedMessages: IncomingMessage[];
  duplicateMatch: BugReport | null;
}

type Severity = 'critical' | 'high' | 'medium' | 'low';

const SEVERITY_OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function BugDetailPage({ bug, linkedMessages, duplicateMatch }: BugDetailPageProps) {
  const router = useRouter();
  const [currentBug, setCurrentBug] = useState(bug);
  const [loading, setLoading] = useState<string | null>(null);

  async function handleStatusChange(status: string) {
    setLoading(status);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('bug_reports')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', currentBug.id)
      .select()
      .single();

    if (error) {
      toast.error('Failed to update status');
    } else {
      setCurrentBug(data as BugReport);
      toast.success('Status updated');
    }
    setLoading(null);
  }

  async function handleSeverityChange(severity: string) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('bug_reports')
      .update({ severity, updated_at: new Date().toISOString() })
      .eq('id', currentBug.id)
      .select()
      .single();

    if (error) {
      toast.error('Failed to update severity');
    } else {
      setCurrentBug(data as BugReport);
      toast.success('Severity updated');
    }
  }

  const confidencePct = currentBug.confidence_score !== null
    ? Math.round(currentBug.confidence_score * 100)
    : null;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <GlassBadge
              variant={currentBug.severity as 'critical' | 'high' | 'medium' | 'low'}
            >
              {currentBug.severity}
            </GlassBadge>
            <GlassBadge
              variant={
                currentBug.status === 'pending_review'
                  ? 'high'
                  : currentBug.status === 'approved'
                  ? 'low'
                  : currentBug.status === 'created_in_monday'
                  ? 'info'
                  : 'default'
              }
            >
              {currentBug.status.replace(/_/g, ' ')}
            </GlassBadge>
            {currentBug.category && (
              <span
                className="text-xs"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                {currentBug.category}
              </span>
            )}
          </div>

          <h1
            className="text-xl font-semibold"
            style={{ color: 'rgba(255,255,255,0.95)' }}
          >
            {currentBug.title}
          </h1>

          <div className="flex items-center gap-4 flex-wrap">
            <span
              className="flex items-center gap-1.5 text-xs"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              <Calendar size={12} />
              {formatDate(currentBug.created_at)}
            </span>
            {currentBug.source_channel && (
              <span
                className="inline-flex items-center gap-1.5 text-xs"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                <PlatformIcon platform={currentBug.source_channel} size={13} />
                via {platformName(currentBug.source_channel)}
              </span>
            )}
            {confidencePct !== null && (
              <span
                className="text-xs"
                style={{
                  color: confidencePct >= 80
                    ? '#30d158'
                    : confidencePct >= 60
                    ? '#ff9f0a'
                    : '#ff453a',
                }}
              >
                {confidencePct}% confidence
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {currentBug.status === 'pending_review' && (
            <>
              <GlassButton
                variant="primary"
                size="sm"
                loading={loading === 'approved'}
                onClick={() => handleStatusChange('approved')}
              >
                <CheckCircle size={13} />
                Approve
              </GlassButton>
              <GlassButton
                variant="danger"
                size="sm"
                loading={loading === 'rejected'}
                onClick={() => handleStatusChange('rejected')}
              >
                <XCircle size={13} />
                Reject
              </GlassButton>
            </>
          )}
          {currentBug.status === 'approved' && (
            <GlassButton
              size="sm"
              loading={loading === 'created_in_monday'}
              onClick={() => handleStatusChange('created_in_monday')}
              style={{
                background: 'rgba(10,132,255,0.15)',
                borderColor: 'rgba(10,132,255,0.3)',
                color: '#0a84ff',
              }}
            >
              <Hash size={13} />
              Create in Monday
            </GlassButton>
          )}
          {currentBug.monday_item_id && (
            <GlassButton
              size="sm"
              onClick={() =>
                window.open(
                  `https://monday.com/boards/item/${currentBug.monday_item_id}`,
                  '_blank',
                )
              }
            >
              <ExternalLink size={13} />
              View in Monday
            </GlassButton>
          )}
        </div>
      </div>

      {/* Escalate severity */}
      <div className="flex items-center gap-3">
        <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Escalate severity:
        </span>
        <GlassSelect
          options={SEVERITY_OPTIONS}
          value={currentBug.severity}
          onChange={handleSeverityChange}
          className="w-36"
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bug details */}
        <div className="space-y-4">
          {currentBug.description && (
            <GlassPanel title="Description">
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'rgba(255,255,255,0.7)' }}
              >
                {currentBug.description}
              </p>
            </GlassPanel>
          )}

          {currentBug.steps_to_reproduce && (
            <GlassPanel title="Steps to Reproduce">
              <p
                className="text-sm leading-relaxed whitespace-pre-wrap"
                style={{ color: 'rgba(255,255,255,0.7)' }}
              >
                {currentBug.steps_to_reproduce}
              </p>
            </GlassPanel>
          )}

          {currentBug.consolidated_summary && (
            <div
              className="p-5 rounded-2xl"
              style={{
                background: 'rgba(10,132,255,0.06)',
                border: '1px solid rgba(10,132,255,0.15)',
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Cpu size={15} style={{ color: '#0a84ff' }} />
                <span
                  className="text-sm font-semibold"
                  style={{ color: '#0a84ff' }}
                >
                  AI Consolidated Summary
                </span>
              </div>
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'rgba(255,255,255,0.7)' }}
              >
                {currentBug.consolidated_summary}
              </p>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Linked reports */}
          <GlassPanel
            title={`Linked Reports (${linkedMessages.length})`}
            actions={
              <MessageSquare size={14} style={{ color: 'rgba(255,255,255,0.35)' }} />
            }
          >
            {linkedMessages.length === 0 ? (
              <p
                className="text-sm"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                No linked messages
              </p>
            ) : (
              <div className="space-y-3">
                {linkedMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-3 rounded-xl"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-medium"
                        style={{ color: 'rgba(255,255,255,0.6)' }}
                      >
                        {msg.sender_name ?? 'Unknown'}
                        <PlatformIcon platform={msg.channel_type} size={12} />
                        via {platformName(msg.channel_type)}
                      </span>
                      <span
                        className="text-xs"
                        style={{ color: 'rgba(255,255,255,0.3)' }}
                      >
                        {new Date(msg.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p
                      className="text-xs line-clamp-3"
                      style={{ color: 'rgba(255,255,255,0.55)' }}
                    >
                      {msg.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </GlassPanel>

          {/* Duplicate match */}
          {duplicateMatch && (
            <div
              className="p-5 rounded-2xl"
              style={{
                background: 'rgba(191,90,242,0.06)',
                border: '1px solid rgba(191,90,242,0.2)',
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <GitMerge size={15} style={{ color: '#bf5af2' }} />
                <span
                  className="text-sm font-semibold"
                  style={{ color: '#bf5af2' }}
                >
                  Possible Duplicate
                </span>
              </div>
              <p
                className="text-sm font-medium mb-1"
                style={{ color: 'rgba(255,255,255,0.85)' }}
              >
                {duplicateMatch.title}
              </p>
              <div className="flex items-center gap-2 mb-3">
                <GlassBadge
                  variant={duplicateMatch.severity as Severity}
                >
                  {duplicateMatch.severity}
                </GlassBadge>
                <span
                  className="text-xs"
                  style={{ color: 'rgba(255,255,255,0.4)' }}
                >
                  {duplicateMatch.status.replace(/_/g, ' ')}
                </span>
              </div>
              <GlassButton
                size="sm"
                onClick={() => router.push(`/bugs/${duplicateMatch.id}`)}
              >
                View match
                <ExternalLink size={12} />
              </GlassButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
