/**
 * BugFlow Worker – extract_bug_data processor
 * Fetches a classified incoming_message, calls the AI extractor,
 * creates a bug_report record, then enqueues deduplicate_bug.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'pino';
import { extractBugData } from '../ai/client.js';

export interface ExtractPayload {
  message_id: string;
}

export interface ExtractResult {
  message_id: string;
  bug_report_id: string;
  title: string;
  severity: string;
  category: string;
  dedup_job_id?: string;
}

export async function processExtractBugData(
  supabase: SupabaseClient,
  payload: ExtractPayload,
  log: Logger,
): Promise<ExtractResult> {
  const { message_id } = payload;

  // -------------------------------------------------------------------------
  // 1. Fetch the incoming_message
  // -------------------------------------------------------------------------
  const { data: message, error: fetchError } = await supabase
    .from('incoming_messages')
    .select('id, team_id, content, platform, channel_id, sender_name, author_name')
    .eq('id', message_id)
    .single();

  if (fetchError || !message) {
    throw new Error(`Failed to fetch incoming_message ${message_id}: ${fetchError?.message ?? 'not found'}`);
  }

  log.info({ message_id, team_id: message.team_id }, 'Extracting bug data');

  // -------------------------------------------------------------------------
  // 2. Call AI extractor
  // -------------------------------------------------------------------------
  const extracted = await extractBugData(message.content as string);

  log.info(
    { message_id, title: extracted.title, severity: extracted.severity, category: extracted.category },
    'Bug data extracted',
  );

  // -------------------------------------------------------------------------
  // 3. Create bug_report record
  // -------------------------------------------------------------------------
  const { data: bugReport, error: insertError } = await supabase
    .from('bug_reports')
    .insert({
      team_id: message.team_id,
      title: extracted.title,
      description: extracted.description,
      steps_to_reproduce: extracted.steps_to_reproduce,
      severity: extracted.severity,
      category: extracted.category,
      status: 'pending_review',
      source_message_ids: [message_id],
    })
    .select('id')
    .single();

  if (insertError || !bugReport) {
    throw new Error(`Failed to create bug_report for message ${message_id}: ${insertError?.message ?? 'insert returned null'}`);
  }

  const bugReportId = (bugReport as { id: string }).id;
  log.info({ message_id, bug_report_id: bugReportId }, 'Bug report created');

  // -------------------------------------------------------------------------
  // 4. Enqueue deduplicate_bug job
  // -------------------------------------------------------------------------
  let dedupJobId: string | undefined;
  const { data: jobData, error: enqueueError } = await supabase.rpc('enqueue_job', {
    p_team_id: message.team_id,
    p_job_type: 'deduplicate_bug',
    p_payload: { bug_report_id: bugReportId },
  });

  if (enqueueError) {
    log.warn(
      { bug_report_id: bugReportId, error: enqueueError.message },
      'Failed to enqueue deduplicate_bug job',
    );
  } else {
    dedupJobId = jobData as string;
    log.info({ bug_report_id: bugReportId, dedup_job_id: dedupJobId }, 'Enqueued deduplicate_bug job');
  }

  return {
    message_id,
    bug_report_id: bugReportId,
    title: extracted.title,
    severity: extracted.severity,
    category: extracted.category,
    dedup_job_id: dedupJobId,
  };
}
