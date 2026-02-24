'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Bug, MessageSquare, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { GlassPanel, GlassBadge, PlatformIcon, platformName, platformColor } from '@/components/ui';
import { useRealtimeMessages } from '@/lib/hooks/use-realtime';
import type { IncomingMessage } from '@/lib/hooks/use-realtime';

interface ActivityFeedProps {
  teamId: string;
  initialMessages: IncomingMessage[];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}


export function ActivityFeed({ teamId, initialMessages }: ActivityFeedProps) {
  const { messages } = useRealtimeMessages(teamId);

  const feed = messages.length > 0 ? messages : initialMessages;
  const recent = feed.slice(0, 20);

  return (
    <GlassPanel
      title="Live Activity"
      actions={
        <span
          className="inline-flex items-center gap-1.5 text-xs"
          style={{ color: 'rgba(255, 255, 255, 0.4)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Realtime
        </span>
      }
    >
      {recent.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <MessageSquare size={32} style={{ color: 'rgba(255,255,255,0.2)' }} />
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            No activity yet. Messages will appear here in real-time.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {recent.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="flex items-start gap-3 p-3 rounded-xl"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <div
                  className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0 mt-0.5"
                  style={{ background: `${platformColor(msg.channel_type)}40` }}
                >
                  <PlatformIcon platform={msg.channel_type} size={14} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className="text-xs font-medium truncate"
                      style={{ color: 'rgba(255, 255, 255, 0.8)' }}
                    >
                      {msg.sender_name ?? 'Unknown'}
                    </span>
                    <span
                      className="text-xs shrink-0"
                      style={{ color: 'rgba(255, 255, 255, 0.35)' }}
                    >
                      via {platformName(msg.channel_type)}
                    </span>
                  </div>
                  <p
                    className="text-xs line-clamp-2"
                    style={{ color: 'rgba(255, 255, 255, 0.5)' }}
                  >
                    {msg.content}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span
                    className="text-xs whitespace-nowrap"
                    style={{ color: 'rgba(255, 255, 255, 0.3)' }}
                  >
                    {timeAgo(msg.created_at)}
                  </span>
                  {msg.bug_report_id && (
                    <GlassBadge variant="info">Linked</GlassBadge>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </GlassPanel>
  );
}
