/**
 * BugFlow Worker – Processor Registry
 * Maps job_type strings to the corresponding processor functions.
 * The queue consumer imports this map to route claimed jobs.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'pino';
import type { JobType } from '@bugflow/shared';

import { processClassifyMessage } from './classify.js';
import { processExtractBugData } from './extract.js';
import { processDeduplicateBug } from './deduplicate.js';
import { processCreateMondayItem } from './monday-create.js';
import { processGenerateSummary } from './summary.js';
import { processDetectTrends } from './trends.js';
import { processGenerateDigest } from './digest.js';

export type ProcessorFn = (
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
  log: Logger,
) => Promise<Record<string, unknown>>;

export const PROCESSORS: Record<JobType, ProcessorFn> = {
  classify_message: (supabase, payload, log) =>
    processClassifyMessage(supabase, payload as Parameters<typeof processClassifyMessage>[1], log) as Promise<Record<string, unknown>>,

  extract_bug_data: (supabase, payload, log) =>
    processExtractBugData(supabase, payload as Parameters<typeof processExtractBugData>[1], log) as Promise<Record<string, unknown>>,

  deduplicate_bug: (supabase, payload, log) =>
    processDeduplicateBug(supabase, payload as Parameters<typeof processDeduplicateBug>[1], log) as Promise<Record<string, unknown>>,

  create_monday_item: (supabase, payload, log) =>
    processCreateMondayItem(supabase, payload as Parameters<typeof processCreateMondayItem>[1], log) as Promise<Record<string, unknown>>,

  generate_summary: (supabase, payload, log) =>
    processGenerateSummary(supabase, payload as Parameters<typeof processGenerateSummary>[1], log) as Promise<Record<string, unknown>>,

  detect_trends: (supabase, payload, log) =>
    processDetectTrends(supabase, payload as Parameters<typeof processDetectTrends>[1], log) as Promise<Record<string, unknown>>,

  generate_digest: (supabase, payload, log) =>
    processGenerateDigest(supabase, payload as Parameters<typeof processGenerateDigest>[1], log) as Promise<Record<string, unknown>>,
};
