/**
 * BugFlow Worker – generate_summary processor
 * Fetches multiple bug_reports and consolidates them into a single
 * AI-generated summary stored on the primary report.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'pino';
import { generateSummary } from '../ai/client.js';

export interface GenerateSummaryPayload {
  bug_report_ids: string[];
  /** The report that will receive the consolidated_summary field */
  primary_bug_report_id?: string;
}

export interface GenerateSummaryResult {
  primary_bug_report_id: string;
  summary: string;
  report_count: number;
}

export async function processGenerateSummary(
  supabase: SupabaseClient,
  payload: GenerateSummaryPayload,
  log: Logger,
): Promise<GenerateSummaryResult> {
  const { bug_report_ids } = payload;

  if (!bug_report_ids || bug_report_ids.length === 0) {
    throw new Error('generate_summary job requires at least one bug_report_id in payload');
  }

  // The primary report is either explicitly specified or the first in the list
  const primaryId = payload.primary_bug_report_id ?? bug_report_ids[0];

  // -------------------------------------------------------------------------
  // 1. Fetch all bug_reports
  // -------------------------------------------------------------------------
  const { data: reports, error: fetchError } = await supabase
    .from('bug_reports')
    .select('id, team_id, title, description, platform, source_message_ids')
    .in('id', bug_report_ids);

  if (fetchError) {
    throw new Error(`Failed to fetch bug_reports: ${fetchError.message}`);
  }
  if (!reports || reports.length === 0) {
    throw new Error(`No bug_reports found for IDs: ${bug_report_ids.join(', ')}`);
  }

  log.info(
    { primary_bug_report_id: primaryId, report_count: reports.length },
    'Generating consolidated summary',
  );

  // -------------------------------------------------------------------------
  // 2. Build report inputs for AI
  // -------------------------------------------------------------------------
  const reportInputs = (reports as Array<{
    id: string;
    team_id: string;
    title: string;
    description: string | null;
    platform: string | null;
  }>).map((r) => ({
    title: r.title,
    description: r.description ?? '',
    source: r.platform ?? 'unknown',
  }));

  // -------------------------------------------------------------------------
  // 3. Generate AI summary
  // -------------------------------------------------------------------------
  const summary = await generateSummary(reportInputs);

  log.info({ primary_bug_report_id: primaryId, summary_length: summary.length }, 'Summary generated');

  // -------------------------------------------------------------------------
  // 4. Persist consolidated_summary on the primary report
  // -------------------------------------------------------------------------
  const { error: updateError } = await supabase
    .from('bug_reports')
    .update({ consolidated_summary: summary })
    .eq('id', primaryId);

  if (updateError) {
    throw new Error(`Failed to update consolidated_summary on ${primaryId}: ${updateError.message}`);
  }

  return {
    primary_bug_report_id: primaryId,
    summary,
    report_count: reports.length,
  };
}
