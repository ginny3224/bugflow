'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, FileText, Bug } from 'lucide-react';
import { GlassBadge } from '@/components/ui';

interface Digest {
  id: string;
  team_id: string;
  week_start: string;
  week_end: string;
  total_bugs: number;
  content_markdown: string;
  created_at: string;
}

interface DigestCardProps {
  digest: Digest;
}

function formatWeekRange(start: string, end: string): string {
  const s = new Date(start).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const e = new Date(end).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${s} – ${e}`;
}

// Simple markdown renderer for digest content
function MarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n');

  return (
    <div className="space-y-3 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
      {lines.map((line, i) => {
        if (line.startsWith('## ')) {
          return (
            <h3
              key={i}
              className="text-base font-semibold mt-4 first:mt-0"
              style={{ color: 'rgba(255,255,255,0.9)' }}
            >
              {line.slice(3)}
            </h3>
          );
        }
        if (line.startsWith('# ')) {
          return (
            <h2
              key={i}
              className="text-lg font-semibold mt-4 first:mt-0"
              style={{ color: 'rgba(255,255,255,0.95)' }}
            >
              {line.slice(2)}
            </h2>
          );
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <li
              key={i}
              className="ml-4 leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.65)' }}
            >
              {line.slice(2)}
            </li>
          );
        }
        if (line.startsWith('**') && line.endsWith('**')) {
          return (
            <p key={i} className="font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
              {line.slice(2, -2)}
            </p>
          );
        }
        if (line.trim() === '') {
          return <div key={i} className="h-1" />;
        }
        return (
          <p key={i} className="leading-relaxed">
            {line}
          </p>
        );
      })}
    </div>
  );
}

export function DigestCard({ digest }: DigestCardProps) {
  const [expanded, setExpanded] = useState(false);
  const weekRange = formatWeekRange(digest.week_start, digest.week_end);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.09)',
      }}
    >
      {/* Header */}
      <button
        className="w-full text-left p-5"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'rgba(10,132,255,0.15)',
              border: '1px solid rgba(10,132,255,0.25)',
            }}
          >
            <FileText size={17} style={{ color: '#0a84ff' }} />
          </div>

          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-semibold"
              style={{ color: 'rgba(255,255,255,0.9)' }}
            >
              {weekRange}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <Bug size={11} style={{ color: 'rgba(255,255,255,0.35)' }} />
              <span
                className="text-xs"
                style={{ color: 'rgba(255,255,255,0.45)' }}
              >
                {digest.total_bugs} bugs this week
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <GlassBadge variant={digest.total_bugs > 20 ? 'high' : digest.total_bugs > 10 ? 'medium' : 'low'}>
              {digest.total_bugs} bugs
            </GlassBadge>
            <div style={{ color: 'rgba(255,255,255,0.4)' }}>
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </div>
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div
              className="px-5 pb-6"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="pt-5">
                <MarkdownContent content={digest.content_markdown} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
