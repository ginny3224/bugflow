/**
 * BugFlow Worker – create_monday_item processor
 * Fetches a bug_report and the team's Monday.com integration config,
 * creates a Monday.com item via GraphQL, and updates the bug_report record.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'pino';
import { createItem } from '../integrations/monday.js';

export interface CreateMondayItemPayload {
  bug_report_id: string;
}

export interface CreateMondayItemResult {
  bug_report_id: string;
  monday_item_id: string;
  board_id: string;
}

// Monday.com column IDs for standard columns — teams may have different IDs.
// We map our domain fields to the most common Monday.com column identifiers.
// If the board uses custom IDs the integration config can override these.
const DEFAULT_COLUMN_MAP: Record<string, string> = {
  severity: 'priority',
  category: 'label',
  status: 'status',
};

interface IntegrationConfig {
  api_key?: string;
  board_id?: string;
  group_id?: string;
  column_map?: Record<string, string>;
}

export async function processCreateMondayItem(
  supabase: SupabaseClient,
  payload: CreateMondayItemPayload,
  log: Logger,
): Promise<CreateMondayItemResult> {
  const { bug_report_id } = payload;

  // -------------------------------------------------------------------------
  // 1. Fetch bug_report
  // -------------------------------------------------------------------------
  const { data: bugReport, error: bugError } = await supabase
    .from('bug_reports')
    .select('id, team_id, title, description, steps_to_reproduce, severity, category, status')
    .eq('id', bug_report_id)
    .single();

  if (bugError || !bugReport) {
    throw new Error(
      `Failed to fetch bug_report ${bug_report_id}: ${bugError?.message ?? 'not found'}`,
    );
  }

  const report = bugReport as {
    id: string;
    team_id: string;
    title: string;
    description: string | null;
    steps_to_reproduce: string | null;
    severity: string | null;
    category: string | null;
    status: string;
  };

  log.info({ bug_report_id, team_id: report.team_id }, 'Creating Monday.com item');

  // -------------------------------------------------------------------------
  // 2. Fetch Monday.com integration config for the team
  // -------------------------------------------------------------------------
  const { data: integration, error: intError } = await supabase
    .from('integrations')
    .select('id, config')
    .eq('team_id', report.team_id)
    .eq('platform', 'monday')
    .eq('enabled', true)
    .maybeSingle();

  if (intError) {
    throw new Error(`Failed to fetch Monday.com integration: ${intError.message}`);
  }
  if (!integration) {
    throw new Error(
      `No active Monday.com integration found for team ${report.team_id}`,
    );
  }

  const config = (integration as { id: string; config: IntegrationConfig }).config;

  if (!config.api_key) {
    throw new Error('Monday.com integration config is missing api_key');
  }
  if (!config.board_id) {
    throw new Error('Monday.com integration config is missing board_id');
  }

  // -------------------------------------------------------------------------
  // 3. Build column values
  // -------------------------------------------------------------------------
  const colMap = { ...DEFAULT_COLUMN_MAP, ...(config.column_map ?? {}) };

  const columnValues: Record<string, string> = {};

  if (report.severity && colMap.severity) {
    columnValues[colMap.severity] = report.severity;
  }
  if (report.category && colMap.category) {
    columnValues[colMap.category] = report.category;
  }
  if (report.description) {
    // Use long-text column if available; fall back to 'text'
    columnValues['text'] = [
      report.description,
      report.steps_to_reproduce ? `\n\nSteps to reproduce:\n${report.steps_to_reproduce}` : '',
    ].join('');
  }

  // -------------------------------------------------------------------------
  // 4. Call Monday.com API
  // -------------------------------------------------------------------------
  const mondayItemId = await createItem(
    config.api_key,
    config.board_id,
    report.title,
    columnValues,
  );

  log.info({ bug_report_id, monday_item_id: mondayItemId, board_id: config.board_id }, 'Monday.com item created');

  // -------------------------------------------------------------------------
  // 5. Update bug_report with Monday item ID and status
  // -------------------------------------------------------------------------
  await supabase
    .from('bug_reports')
    .update({
      monday_item_id: mondayItemId,
      status: 'created_in_monday',
    })
    .eq('id', bug_report_id);

  // -------------------------------------------------------------------------
  // 6. Upsert monday_backlog_items cache row
  // -------------------------------------------------------------------------
  await supabase
    .from('monday_backlog_items')
    .upsert(
      {
        team_id: report.team_id,
        monday_item_id: mondayItemId,
        monday_board_id: config.board_id,
        name: report.title,
        description: report.description,
        synced_at: new Date().toISOString(),
      },
      { onConflict: 'team_id,monday_item_id' },
    );

  return {
    bug_report_id,
    monday_item_id: mondayItemId,
    board_id: config.board_id,
  };
}
