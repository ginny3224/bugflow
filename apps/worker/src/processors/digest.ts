/**
 * BugFlow Worker – generate_digest processor
 * Aggregates a week's worth of bug data, calls the AI digest generator,
 * and inserts a weekly_digests record.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'pino';
import { generateDigest } from '../ai/client.js';

export interface GenerateDigestPayload {
  team_id: string;
  /** ISO date string for the start of the week */
  week_start: string;
  /** ISO date string for the end of the week */
  week_end: string;
}

export interface DigestStats {
  total: number;
  by_severity: Record<string, number>;
  by_category: Record<string, number>;
  by_status: Record<string, number>;
}

export interface GenerateDigestResult {
  team_id: string;
  digest_id: string;
  week_start: string;
  week_end: string;
  content_length: number;
  stats: DigestStats;
}

export async function processGenerateDigest(
  supabase: SupabaseClient,
  payload: GenerateDigestPayload,
  log: Logger,
): Promise<GenerateDigestResult> {
  const { team_id, week_start, week_end } = payload;

  if (!week_start || !week_end) {
    throw new Error('generate_digest requires week_start and week_end in payload');
  }

  log.info({ team_id, week_start, week_end }, 'Generating weekly digest');

  // -------------------------------------------------------------------------
  // 1. Query all bug_reports within the week window
  // -------------------------------------------------------------------------
  const { data: bugs, error: bugError } = await supabase
    .from('bug_reports')
    .select('id, title, description, severity, category, status, created_at')
    .eq('team_id', team_id)
    .gte('created_at', week_start)
    .lte('created_at', week_end)
    .order('created_at', { ascending: false });

  if (bugError) {
    throw new Error(`Failed to query bug_reports for digest: ${bugError.message}`);
  }

  const allBugs = (bugs ?? []) as Array<{
    id: string;
    title: string;
    description: string | null;
    severity: string | null;
    category: string | null;
    status: string;
    created_at: string;
  }>;

  // -------------------------------------------------------------------------
  // 2. Build aggregate stats
  // -------------------------------------------------------------------------
  const stats: DigestStats = {
    total: allBugs.length,
    by_severity: {},
    by_category: {},
    by_status: {},
  };

  for (const bug of allBugs) {
    const sev = bug.severity ?? 'unknown';
    const cat = bug.category ?? 'other';
    const st = bug.status ?? 'unknown';

    stats.by_severity[sev] = (stats.by_severity[sev] ?? 0) + 1;
    stats.by_category[cat] = (stats.by_category[cat] ?? 0) + 1;
    stats.by_status[st] = (stats.by_status[st] ?? 0) + 1;
  }

  // -------------------------------------------------------------------------
  // 3. Query trend_alerts for the week
  // -------------------------------------------------------------------------
  const { data: alertRows } = await supabase
    .from('trend_alerts')
    .select('id, alert_type, title, description, category, bug_count, created_at')
    .eq('team_id', team_id)
    .gte('created_at', week_start)
    .lte('created_at', week_end)
    .order('created_at', { ascending: false });

  const trends = (alertRows ?? []) as Record<string, unknown>[];

  // -------------------------------------------------------------------------
  // 4. Pick top bugs for the digest (critical/high first, then most recent)
  // -------------------------------------------------------------------------
  const severityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    unknown: 4,
  };

  const topBugs = [...allBugs]
    .sort(
      (a, b) =>
        (severityOrder[a.severity ?? 'unknown'] ?? 4) -
        (severityOrder[b.severity ?? 'unknown'] ?? 4),
    )
    .slice(0, 10)
    .map((b) => ({
      id: b.id,
      title: b.title,
      description: b.description?.slice(0, 200) ?? '',
      severity: b.severity,
      category: b.category,
      status: b.status,
    })) as Record<string, unknown>[];

  // -------------------------------------------------------------------------
  // 5. Build week label (ISO 8601 week: YYYY-Www)
  // -------------------------------------------------------------------------
  const startDate = new Date(week_start);
  const weekNumber = getISOWeekNumber(startDate);
  const weekLabel = `${startDate.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;

  // -------------------------------------------------------------------------
  // 6. Generate AI digest content
  // -------------------------------------------------------------------------
  const statsWithLabel = { ...stats, week_label: weekLabel, week_start, week_end };
  const content = await generateDigest(
    statsWithLabel as Record<string, unknown>,
    trends,
    topBugs,
  );

  log.info({ team_id, week_label: weekLabel, content_length: content.length }, 'Digest content generated');

  // -------------------------------------------------------------------------
  // 7. Insert weekly_digests record
  // -------------------------------------------------------------------------
  const { data: digest, error: insertError } = await supabase
    .from('weekly_digests')
    .insert({
      team_id,
      week_start,
      week_end,
      content,
      stats: statsWithLabel,
    })
    .select('id')
    .single();

  if (insertError || !digest) {
    throw new Error(`Failed to insert weekly_digest: ${insertError?.message ?? 'insert returned null'}`);
  }

  const digestId = (digest as { id: string }).id;

  log.info({ team_id, digest_id: digestId, week_label: weekLabel }, 'Weekly digest created');

  return {
    team_id,
    digest_id: digestId,
    week_start,
    week_end,
    content_length: content.length,
    stats,
  };
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Thursday of the current week determines the ISO year
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}
