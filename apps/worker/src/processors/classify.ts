/**
 * BugFlow Worker – classify_message processor
 * Fetches an incoming_message, runs the AI classifier, updates the record,
 * and optionally enqueues an extract_bug_data job.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'pino';
import { classifyMessage } from '../ai/client.js';

// Minimum confidence to proceed to extraction. Teams can override via
// team_settings.bug_confidence_threshold, but we use a sensible default.
const DEFAULT_BUG_CONFIDENCE_THRESHOLD = 0.6;

export interface ClassifyPayload {
  message_id: string;
  integration_id?: string;
  platform?: string;
}

export interface ClassifyResult {
  message_id: string;
  is_bug: boolean;
  confidence: number;
  reasoning: string;
  extract_job_id?: string;
}

export async function processClassifyMessage(
  supabase: SupabaseClient,
  payload: ClassifyPayload,
  log: Logger,
): Promise<ClassifyResult> {
  const { message_id } = payload;

  // -------------------------------------------------------------------------
  // 1. Fetch the incoming_message record
  // -------------------------------------------------------------------------
  const { data: message, error: fetchError } = await supabase
    .from('incoming_messages')
    .select('id, team_id, content, classification_status')
    .eq('id', message_id)
    .single();

  if (fetchError || !message) {
    throw new Error(`Failed to fetch incoming_message ${message_id}: ${fetchError?.message ?? 'not found'}`);
  }

  log.info({ message_id, team_id: message.team_id }, 'Classifying message');

  // -------------------------------------------------------------------------
  // 2. Mark as processing
  // -------------------------------------------------------------------------
  await supabase
    .from('incoming_messages')
    .update({ classification_status: 'processing' })
    .eq('id', message_id);

  // -------------------------------------------------------------------------
  // 3. Fetch team settings for threshold (fall back to default if not found)
  // -------------------------------------------------------------------------
  const { data: settings } = await supabase
    .from('team_settings')
    .select('bug_confidence_threshold')
    .eq('team_id', message.team_id)
    .maybeSingle();

  const threshold: number =
    (settings as { bug_confidence_threshold?: number } | null)?.bug_confidence_threshold ??
    DEFAULT_BUG_CONFIDENCE_THRESHOLD;

  // -------------------------------------------------------------------------
  // 4. Call AI classifier
  // -------------------------------------------------------------------------
  let classificationResult: { is_bug: boolean; confidence: number; reasoning: string };
  try {
    classificationResult = await classifyMessage(message.content as string);
  } catch (err) {
    // Mark classification as error and re-throw so the job enters retry
    await supabase
      .from('incoming_messages')
      .update({
        classification_status: 'error',
        classified_at: new Date().toISOString(),
      })
      .eq('id', message_id);
    throw err;
  }

  const { is_bug, confidence, reasoning } = classificationResult;

  // -------------------------------------------------------------------------
  // 5. Persist classification result
  // -------------------------------------------------------------------------
  const newStatus = is_bug && confidence >= threshold ? 'classified' : 'not_bug';

  await supabase
    .from('incoming_messages')
    .update({
      classification_status: newStatus,
      classification_confidence: confidence,
      classification_reasoning: reasoning,
      classified_at: new Date().toISOString(),
    })
    .eq('id', message_id);

  log.info(
    { message_id, is_bug, confidence, threshold, newStatus },
    'Message classified',
  );

  // -------------------------------------------------------------------------
  // 6. Enqueue extract_bug_data if confidence meets threshold
  // -------------------------------------------------------------------------
  let extractJobId: string | undefined;
  if (is_bug && confidence >= threshold) {
    const { data: jobData, error: enqueueError } = await supabase.rpc('enqueue_job', {
      p_team_id: message.team_id,
      p_job_type: 'extract_bug_data',
      p_payload: { message_id },
    });

    if (enqueueError) {
      log.warn({ message_id, error: enqueueError.message }, 'Failed to enqueue extract_bug_data job');
    } else {
      extractJobId = jobData as string;
      log.info({ message_id, extract_job_id: extractJobId }, 'Enqueued extract_bug_data job');
    }
  }

  return { message_id, is_bug, confidence, reasoning, extract_job_id: extractJobId };
}
