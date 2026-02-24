/**
 * BugFlow Shared Constants
 * Single source of truth for all domain enumerations and default configuration.
 */

import type {
  Platform,
  BugSeverity,
  BugStatus,
  JobType,
  ClassificationStatus,
  TeamSettings,
} from './types';

// ---------------------------------------------------------------------------
// Platforms
// ---------------------------------------------------------------------------

export const PLATFORMS: ReadonlyArray<{
  value: Platform;
  label: string;
  /** Whether this platform supports two-way write-back (e.g. posting replies) */
  supports_replies: boolean;
}> = [
  { value: 'slack', label: 'Slack', supports_replies: true },
  { value: 'discord', label: 'Discord', supports_replies: true },
  { value: 'intercom', label: 'Intercom', supports_replies: true },
  { value: 'telegram', label: 'Telegram', supports_replies: true },
  { value: 'monday', label: 'Monday.com', supports_replies: false },
] as const;

// ---------------------------------------------------------------------------
// Severities
// ---------------------------------------------------------------------------

export const SEVERITIES: ReadonlyArray<{
  value: BugSeverity;
  label: string;
  /** Tailwind-compatible hex color string for UI badges */
  color: string;
  /** Relative ordering weight — lower number = higher urgency */
  order: number;
}> = [
  { value: 'critical', label: 'Critical', color: '#dc2626', order: 1 },
  { value: 'high', label: 'High', color: '#ea580c', order: 2 },
  { value: 'medium', label: 'Medium', color: '#ca8a04', order: 3 },
  { value: 'low', label: 'Low', color: '#16a34a', order: 4 },
] as const;

// ---------------------------------------------------------------------------
// Bug statuses
// ---------------------------------------------------------------------------

export const BUG_STATUSES: ReadonlyArray<{
  value: BugStatus;
  label: string;
  /** Whether this is a terminal (non-actionable) state */
  is_terminal: boolean;
}> = [
  { value: 'pending_review', label: 'Pending Review', is_terminal: false },
  { value: 'approved', label: 'Approved', is_terminal: false },
  { value: 'rejected', label: 'Rejected', is_terminal: true },
  { value: 'merged', label: 'Merged as Duplicate', is_terminal: true },
  {
    value: 'created_in_monday',
    label: 'Created in Monday',
    is_terminal: true,
  },
] as const;

// ---------------------------------------------------------------------------
// Job types
// ---------------------------------------------------------------------------

export const JOB_TYPES: ReadonlyArray<{
  value: JobType;
  label: string;
  /** Whether the job is scheduled on a recurring cadence vs. event-driven */
  is_scheduled: boolean;
}> = [
  {
    value: 'classify_message',
    label: 'Classify Message',
    is_scheduled: false,
  },
  {
    value: 'extract_bug_data',
    label: 'Extract Bug Data',
    is_scheduled: false,
  },
  {
    value: 'deduplicate_bug',
    label: 'Deduplicate Bug',
    is_scheduled: false,
  },
  {
    value: 'create_monday_item',
    label: 'Create Monday Item',
    is_scheduled: false,
  },
  {
    value: 'generate_summary',
    label: 'Generate Summary',
    is_scheduled: false,
  },
  {
    value: 'detect_trends',
    label: 'Detect Trends',
    is_scheduled: true,
  },
  {
    value: 'generate_digest',
    label: 'Generate Weekly Digest',
    is_scheduled: true,
  },
] as const;

// ---------------------------------------------------------------------------
// Classification statuses
// ---------------------------------------------------------------------------

export const CLASSIFICATION_STATUSES: ReadonlyArray<{
  value: ClassificationStatus;
  label: string;
  /** Whether further processing should be awaited */
  is_terminal: boolean;
}> = [
  { value: 'pending', label: 'Pending', is_terminal: false },
  { value: 'processing', label: 'Processing', is_terminal: false },
  { value: 'classified', label: 'Classified as Bug', is_terminal: true },
  { value: 'not_bug', label: 'Not a Bug', is_terminal: true },
  { value: 'error', label: 'Classification Error', is_terminal: true },
] as const;

// ---------------------------------------------------------------------------
// Default team settings
// Omit DB-managed columns (id, team_id, created_at, updated_at).
// ---------------------------------------------------------------------------

export const DEFAULT_SETTINGS: Omit<
  TeamSettings,
  'id' | 'team_id' | 'created_at' | 'updated_at'
> = {
  auto_approve_threshold: 0.9,
  auto_reject_threshold: 0.2,
  dedup_window_days: 30,
  dedup_similarity_threshold: 0.85,
  monday_board_id: null,
  monday_group_id: null,
  /** 1 = Monday */
  digest_day_of_week: 1,
  digest_hour_utc: 8,
  notify_on_alerts: true,
  alert_notification_channels: [],
} as const;
