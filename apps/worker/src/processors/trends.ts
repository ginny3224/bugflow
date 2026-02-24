/**
 * BugFlow Worker – detect_trends processor
 * Queries bug_reports from the last 24 hours grouped by category,
 * checks for spikes, and inserts trend_alert records when thresholds are exceeded.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'pino';

export interface DetectTrendsPayload {
  team_id: string;
  /** Override window in minutes (defaults to 60) */
  window_minutes?: number;
  /** Override spike count threshold (defaults to team_settings or 5) */
  spike_threshold?: number;
}

export interface TrendCategory {
  category: string;
  count: number;
  is_spike: boolean;
}

export interface DetectTrendsResult {
  team_id: string;
  window_minutes: number;
  categories_checked: number;
  spikes_detected: number;
  alert_ids: string[];
  trends: TrendCategory[];
}

export async function processDetectTrends(
  supabase: SupabaseClient,
  payload: DetectTrendsPayload,
  log: Logger,
): Promise<DetectTrendsResult> {
  const { team_id } = payload;

  // -------------------------------------------------------------------------
  // 1. Load team_settings for thresholds
  // -------------------------------------------------------------------------
  const { data: settings } = await supabase
    .from('team_settings')
    .select('spike_threshold, spike_window_minutes')
    .eq('team_id', team_id)
    .maybeSingle();

  const typedSettings = settings as {
    spike_threshold?: number;
    spike_window_minutes?: number;
  } | null;

  const windowMinutes: number =
    payload.window_minutes ?? typedSettings?.spike_window_minutes ?? 60;
  const spikeThreshold: number =
    payload.spike_threshold ?? typedSettings?.spike_threshold ?? 5;

  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const windowEnd = new Date().toISOString();

  log.info({ team_id, window_minutes: windowMinutes, spike_threshold: spikeThreshold }, 'Detecting trends');

  // -------------------------------------------------------------------------
  // 2. Query bug_reports grouped by category within the time window
  // -------------------------------------------------------------------------
  const { data: recentBugs, error: queryError } = await supabase
    .from('bug_reports')
    .select('category')
    .eq('team_id', team_id)
    .gte('created_at', windowStart)
    .lte('created_at', windowEnd)
    .not('status', 'in', '("rejected","merged")');

  if (queryError) {
    throw new Error(`Failed to query bug_reports for trends: ${queryError.message}`);
  }

  // Count per category
  const categoryCounts = new Map<string, number>();
  for (const bug of (recentBugs ?? []) as Array<{ category: string | null }>) {
    const cat = bug.category ?? 'other';
    categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
  }

  // -------------------------------------------------------------------------
  // 3. Check for spikes and create alerts
  // -------------------------------------------------------------------------
  const alertIds: string[] = [];
  const trends: TrendCategory[] = [];

  for (const [category, count] of categoryCounts.entries()) {
    const isSpike = count >= spikeThreshold;
    trends.push({ category, count, is_spike: isSpike });

    if (!isSpike) continue;

    log.warn({ team_id, category, count, threshold: spikeThreshold }, 'Spike detected');

    const summary = `Spike detected: ${count} ${category} bug${count === 1 ? '' : 's'} in the last ${windowMinutes} minutes`;
    const details = [
      `Category: ${category}`,
      `Bug count: ${count}`,
      `Time window: ${windowMinutes} minutes (${windowStart} – ${windowEnd})`,
      `Threshold: ${spikeThreshold}`,
    ].join('\n');

    const { data: alert, error: alertError } = await supabase
      .from('trend_alerts')
      .insert({
        team_id,
        alert_type: 'spike',
        title: summary,
        description: details,
        category,
        bug_count: count,
        time_window_minutes: windowMinutes,
        acknowledged: false,
      })
      .select('id')
      .single();

    if (alertError) {
      log.error({ team_id, category, error: alertError.message }, 'Failed to insert trend_alert');
    } else if (alert) {
      alertIds.push((alert as { id: string }).id);
    }
  }

  log.info(
    {
      team_id,
      categories_checked: categoryCounts.size,
      spikes_detected: alertIds.length,
    },
    'Trend detection complete',
  );

  return {
    team_id,
    window_minutes: windowMinutes,
    categories_checked: categoryCounts.size,
    spikes_detected: alertIds.length,
    alert_ids: alertIds,
    trends,
  };
}
