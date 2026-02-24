/**
 * BugFlow Worker – Job Queue Consumer
 * Polls Supabase every 2 seconds using the claim_job() RPC function,
 * routes claimed jobs to the appropriate processor, and handles
 * success/failure lifecycle including exponential back-off retries.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'pino';
import type { JobType } from '@bugflow/shared';
import { PROCESSORS } from './processors/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PollerConfig {
  workerId: string;
  /** Supported job types. Defaults to all known types if omitted. */
  supportedJobTypes?: JobType[];
  /** Poll interval in milliseconds. Default: 2000 */
  pollIntervalMs?: number;
  /** Maximum back-off multiplier (seconds). Default: 300 (5 minutes) */
  maxRetryDelaySeconds?: number;
}

interface JobRow {
  id: string;
  team_id: string;
  job_type: string;
  status: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  error: string | null;
  worker_id: string | null;
  claimed_at: string | null;
}

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let pollerTimer: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;
let jobsProcessed = 0;

export function getJobsProcessed(): number {
  return jobsProcessed;
}

// ---------------------------------------------------------------------------
// Back-off calculation
// ---------------------------------------------------------------------------

/**
 * Exponential back-off: 2^attempt seconds, capped at maxRetryDelaySeconds.
 * Returns a future ISO timestamp.
 */
function nextRetryAt(attempt: number, maxDelaySeconds: number): string {
  const delaySeconds = Math.min(Math.pow(2, attempt), maxDelaySeconds);
  return new Date(Date.now() + delaySeconds * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// Core poll-and-process loop
// ---------------------------------------------------------------------------

async function pollOnce(
  supabase: SupabaseClient,
  config: Required<PollerConfig>,
  log: Logger,
): Promise<void> {
  // Claim one job atomically
  const { data, error: rpcError } = await supabase.rpc('claim_job', {
    p_worker_id: config.workerId,
    p_job_types: config.supportedJobTypes,
  });

  if (rpcError) {
    log.error({ error: rpcError.message }, 'claim_job RPC failed');
    return;
  }

  // claim_job returns SETOF job_queue — Supabase wraps it as an array
  const rows = data as JobRow[] | null;
  if (!rows || rows.length === 0) {
    // No job available; this is the common idle case
    return;
  }

  const job = rows[0];
  const jobLog = log.child({ job_id: job.id, job_type: job.job_type, team_id: job.team_id, attempt: job.attempts });

  jobLog.info('Job claimed');

  const processor = PROCESSORS[job.job_type as JobType];
  if (!processor) {
    jobLog.error('No processor registered for job type; marking failed');
    await markFailed(supabase, job.id, `No processor for job type: ${job.job_type}`, jobLog);
    return;
  }

  try {
    const result = await processor(supabase, job.payload, jobLog);

    await supabase
      .from('job_queue')
      .update({
        status: 'completed',
        result,
        completed_at: new Date().toISOString(),
        error: null,
      })
      .eq('id', job.id);

    jobsProcessed += 1;
    jobLog.info({ jobs_processed_total: jobsProcessed }, 'Job completed');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    jobLog.warn({ error: message }, 'Job failed');

    if (job.attempts >= job.max_attempts) {
      await markFailed(supabase, job.id, message, jobLog);
    } else {
      const retryAt = nextRetryAt(job.attempts, config.maxRetryDelaySeconds);
      await supabase
        .from('job_queue')
        .update({
          status: 'retry',
          error: message,
          next_retry_at: retryAt,
        })
        .eq('id', job.id);

      jobLog.info({ next_retry_at: retryAt }, 'Job scheduled for retry');
    }
  }
}

async function markFailed(
  supabase: SupabaseClient,
  jobId: string,
  message: string,
  log: Logger,
): Promise<void> {
  await supabase
    .from('job_queue')
    .update({
      status: 'failed',
      error: message,
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  log.error({ job_id: jobId }, 'Job permanently failed');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start the polling loop. Safe to call multiple times; subsequent calls are no-ops.
 */
export function startPoller(
  supabase: SupabaseClient,
  config: PollerConfig,
  log: Logger,
): void {
  if (isRunning) return;
  isRunning = true;

  const resolvedConfig: Required<PollerConfig> = {
    workerId: config.workerId,
    supportedJobTypes: config.supportedJobTypes ?? (Object.keys(PROCESSORS) as JobType[]),
    pollIntervalMs: config.pollIntervalMs ?? 2000,
    maxRetryDelaySeconds: config.maxRetryDelaySeconds ?? 300,
  };

  log.info(
    {
      worker_id: resolvedConfig.workerId,
      poll_interval_ms: resolvedConfig.pollIntervalMs,
      supported_job_types: resolvedConfig.supportedJobTypes,
    },
    'Job queue poller started',
  );

  const schedule = (): void => {
    pollerTimer = setTimeout(async () => {
      if (!isRunning) return;
      try {
        await pollOnce(supabase, resolvedConfig, log);
      } catch (err) {
        log.error({ error: err instanceof Error ? err.message : String(err) }, 'Unexpected error in poll loop');
      }
      if (isRunning) schedule();
    }, resolvedConfig.pollIntervalMs);
  };

  schedule();
}

/**
 * Stop the polling loop gracefully.
 */
export function stopPoller(log: Logger): void {
  if (!isRunning) return;
  isRunning = false;
  if (pollerTimer !== null) {
    clearTimeout(pollerTimer);
    pollerTimer = null;
  }
  log.info('Job queue poller stopped');
}
