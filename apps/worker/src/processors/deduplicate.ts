/**
 * BugFlow Worker – deduplicate_bug processor
 * Fetches a new bug_report, performs a SQL pre-filter for candidates using
 * full-text search against monday_backlog_items and title similarity against
 * existing bug_reports, then calls the AI dedup function.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'pino';
import { checkDuplicate, type DedupCandidate } from '../ai/client.js';

const MAX_CANDIDATES = 20;
// Similarity score above which we mark the bug as merged/duplicate
const HIGH_CONFIDENCE_MERGE_THRESHOLD = 0.85;

export interface DeduplicatePayload {
  bug_report_id: string;
}

export interface DeduplicateResult {
  bug_report_id: string;
  is_duplicate: boolean;
  match_id?: string;
  similarity_score: number;
  reasoning: string;
  action: 'merged' | 'kept' | 'no_candidates';
}

export async function processDeduplicateBug(
  supabase: SupabaseClient,
  payload: DeduplicatePayload,
  log: Logger,
): Promise<DeduplicateResult> {
  const { bug_report_id } = payload;

  // -------------------------------------------------------------------------
  // 1. Fetch the bug_report
  // -------------------------------------------------------------------------
  const { data: bugReport, error: fetchError } = await supabase
    .from('bug_reports')
    .select('id, team_id, title, description, created_at')
    .eq('id', bug_report_id)
    .single();

  if (fetchError || !bugReport) {
    throw new Error(
      `Failed to fetch bug_report ${bug_report_id}: ${fetchError?.message ?? 'not found'}`,
    );
  }

  const report = bugReport as {
    id: string;
    team_id: string;
    title: string;
    description: string | null;
    created_at: string;
  };

  log.info({ bug_report_id, team_id: report.team_id }, 'Deduplicating bug report');

  // -------------------------------------------------------------------------
  // 2. SQL pre-filter – full-text search in monday_backlog_items
  // -------------------------------------------------------------------------
  const searchTerms = report.title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 2)
    .slice(0, 8)
    .join(' & ');

  const candidates: DedupCandidate[] = [];

  if (searchTerms.length > 0) {
    const { data: mondayItems } = await supabase
      .from('monday_backlog_items')
      .select('id, name, description')
      .eq('team_id', report.team_id)
      .textSearch('search_vector', searchTerms, { type: 'websearch' })
      .limit(10);

    if (mondayItems) {
      for (const item of mondayItems) {
        const typedItem = item as { id: string; name: string; description: string | null };
        candidates.push({
          id: typedItem.id,
          name: typedItem.name,
          description: typedItem.description,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // 3. SQL pre-filter – similar titles in existing bug_reports (same team)
  // -------------------------------------------------------------------------
  const { data: existingBugs } = await supabase
    .from('bug_reports')
    .select('id, title, description')
    .eq('team_id', report.team_id)
    .neq('id', bug_report_id)
    .not('status', 'in', '("rejected")')
    .limit(MAX_CANDIDATES - candidates.length);

  if (existingBugs) {
    for (const bug of existingBugs) {
      const typedBug = bug as { id: string; title: string; description: string | null };
      // Avoid adding the same candidate twice
      if (!candidates.find((c) => c.id === typedBug.id)) {
        candidates.push({
          id: typedBug.id,
          name: typedBug.title,
          description: typedBug.description,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // 4. Short-circuit when no candidates are available
  // -------------------------------------------------------------------------
  if (candidates.length === 0) {
    log.info({ bug_report_id }, 'No dedup candidates found; skipping AI check');
    return {
      bug_report_id,
      is_duplicate: false,
      similarity_score: 0,
      reasoning: 'No existing bugs or Monday items found to compare against.',
      action: 'no_candidates',
    };
  }

  log.info({ bug_report_id, candidate_count: candidates.length }, 'Running AI dedup check');

  // -------------------------------------------------------------------------
  // 5. AI deduplication
  // -------------------------------------------------------------------------
  const dedupResult = await checkDuplicate(
    report.title,
    report.description ?? '',
    candidates.slice(0, MAX_CANDIDATES),
  );

  // -------------------------------------------------------------------------
  // 6. Persist dedup result and potentially merge
  // -------------------------------------------------------------------------
  const shouldMerge =
    dedupResult.is_duplicate && dedupResult.similarity_score >= HIGH_CONFIDENCE_MERGE_THRESHOLD;

  const updates: Record<string, unknown> = {
    dedup_score: dedupResult.similarity_score,
    dedup_match_id: dedupResult.match_id ?? null,
  };

  if (shouldMerge && dedupResult.match_id) {
    updates.status = 'merged';
    updates.duplicate_of = dedupResult.match_id;
  }

  await supabase
    .from('bug_reports')
    .update(updates)
    .eq('id', bug_report_id);

  log.info(
    {
      bug_report_id,
      is_duplicate: dedupResult.is_duplicate,
      similarity_score: dedupResult.similarity_score,
      match_id: dedupResult.match_id,
      merged: shouldMerge,
    },
    'Dedup complete',
  );

  return {
    bug_report_id,
    is_duplicate: dedupResult.is_duplicate,
    match_id: dedupResult.match_id,
    similarity_score: dedupResult.similarity_score,
    reasoning: dedupResult.reasoning,
    action: shouldMerge ? 'merged' : 'kept',
  };
}
