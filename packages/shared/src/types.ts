/**
 * BugFlow Shared Types
 * Core domain types for all BugFlow services and packages.
 */

// ---------------------------------------------------------------------------
// Primitive branded types
// ---------------------------------------------------------------------------

/** ISO-8601 datetime string */
export type ISODateString = string;

// ---------------------------------------------------------------------------
// Platform
// ---------------------------------------------------------------------------

export type Platform =
  | 'slack'
  | 'discord'
  | 'intercom'
  | 'telegram'
  | 'monday'
  | 'x';

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

export type TeamRole = 'owner' | 'admin' | 'member';

export interface Team {
  id: string;
  name: string;
  slug: string;
  created_at: ISODateString;
  updated_at: ISODateString;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  joined_at: ISODateString;
}

export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface TeamInvite {
  id: string;
  team_id: string;
  invited_by_user_id: string;
  email: string;
  role: TeamRole;
  status: InviteStatus;
  token: string;
  expires_at: ISODateString;
  created_at: ISODateString;
  accepted_at: ISODateString | null;
}

// ---------------------------------------------------------------------------
// Integration
// ---------------------------------------------------------------------------

export interface Integration {
  id: string;
  team_id: string;
  platform: Platform;
  /** Human-readable label for this integration connection */
  name: string;
  /** Opaque credentials/config stored per platform */
  config: Record<string, unknown>;
  /** Whether this integration is actively receiving messages */
  is_active: boolean;
  created_at: ISODateString;
  updated_at: ISODateString;
}

// ---------------------------------------------------------------------------
// IncomingMessage
// ---------------------------------------------------------------------------

export type ClassificationStatus =
  | 'pending'
  | 'processing'
  | 'classified'
  | 'not_bug'
  | 'error';

export interface IncomingMessage {
  id: string;
  team_id: string;
  integration_id: string;
  platform: Platform;
  /** External message ID from the source platform */
  external_id: string;
  /** Channel / conversation identifier on the source platform */
  channel_id: string;
  /** Display name of the sender on the source platform */
  sender_name: string | null;
  /** Raw message text */
  content: string;
  /** Raw webhook payload as received */
  raw_payload: Record<string, unknown>;
  classification_status: ClassificationStatus;
  /** Confidence score [0, 1] produced by the classifier, null until classified */
  classification_confidence: number | null;
  /** Free-text reasoning from the classifier */
  classification_reasoning: string | null;
  received_at: ISODateString;
  classified_at: ISODateString | null;
}

// ---------------------------------------------------------------------------
// BugReport
// ---------------------------------------------------------------------------

export type BugStatus =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'merged'
  | 'created_in_monday';

export type BugSeverity = 'critical' | 'high' | 'medium' | 'low';

export type BugCategory =
  | 'ui_ux'
  | 'performance'
  | 'data_loss'
  | 'security'
  | 'crash'
  | 'api'
  | 'authentication'
  | 'integration'
  | 'other';

export interface BugReport {
  id: string;
  team_id: string;
  incoming_message_id: string;
  /** Monday.com item ID once created */
  monday_item_id: string | null;
  title: string;
  description: string;
  steps_to_reproduce: string | null;
  severity: BugSeverity;
  category: BugCategory;
  status: BugStatus;
  /** ID of the BugReport this was merged into, if status is 'merged' */
  merged_into_id: string | null;
  /** Similarity score [0, 1] against the duplicate target, null if not a duplicate */
  duplicate_similarity_score: number | null;
  /** User ID of the reviewer who approved/rejected, null until reviewed */
  reviewed_by_user_id: string | null;
  reviewed_at: ISODateString | null;
  created_at: ISODateString;
  updated_at: ISODateString;
}

// ---------------------------------------------------------------------------
// MondayBacklogItem
// ---------------------------------------------------------------------------

export interface MondayBacklogItem {
  id: string;
  team_id: string;
  bug_report_id: string;
  /** Monday.com board ID */
  monday_board_id: string;
  /** Monday.com item ID */
  monday_item_id: string;
  monday_item_name: string;
  /** Column values snapshot at creation time */
  monday_column_values: Record<string, unknown>;
  /** URL to the Monday.com item */
  monday_item_url: string | null;
  synced_at: ISODateString;
  created_at: ISODateString;
}

// ---------------------------------------------------------------------------
// Job
// ---------------------------------------------------------------------------

export type JobType =
  | 'classify_message'
  | 'extract_bug_data'
  | 'deduplicate_bug'
  | 'create_monday_item'
  | 'generate_summary'
  | 'detect_trends'
  | 'generate_digest';

export type JobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'retry';

export interface Job {
  id: string;
  team_id: string;
  job_type: JobType;
  status: JobStatus;
  /** Typed payload specific to each job_type */
  payload: Record<string, unknown>;
  /** Result data written on completion */
  result: Record<string, unknown> | null;
  /** Human-readable error message on failure */
  error_message: string | null;
  attempt_count: number;
  max_attempts: number;
  /** Earliest time this job may next be picked up (for retry back-off) */
  scheduled_at: ISODateString;
  started_at: ISODateString | null;
  completed_at: ISODateString | null;
  created_at: ISODateString;
  updated_at: ISODateString;
}

// ---------------------------------------------------------------------------
// TrendAlert
// ---------------------------------------------------------------------------

export type AlertType = 'spike' | 'trend' | 'regression';

export interface TrendAlert {
  id: string;
  team_id: string;
  alert_type: AlertType;
  /** Affected category, null if alert spans all categories */
  category: BugCategory | null;
  /** Affected severity, null if alert spans all severities */
  severity: BugSeverity | null;
  /** Short human-readable summary of the alert */
  summary: string;
  /** Detailed analysis text */
  details: string;
  /** Structured metric snapshot that triggered the alert */
  metrics: Record<string, unknown>;
  /** Number of bugs involved in this alert */
  bug_count: number;
  /** Time window start for the analysis */
  window_start: ISODateString;
  /** Time window end for the analysis */
  window_end: ISODateString;
  /** Whether an operator has acknowledged this alert */
  acknowledged: boolean;
  acknowledged_by_user_id: string | null;
  acknowledged_at: ISODateString | null;
  created_at: ISODateString;
}

// ---------------------------------------------------------------------------
// WeeklyDigest
// ---------------------------------------------------------------------------

export interface DigestBugBreakdown {
  total: number;
  by_severity: Record<BugSeverity, number>;
  by_category: Record<BugCategory, number>;
  by_status: Record<BugStatus, number>;
}

export interface WeeklyDigest {
  id: string;
  team_id: string;
  /** ISO week string, e.g. "2026-W07" */
  week_label: string;
  week_start: ISODateString;
  week_end: ISODateString;
  /** Rendered markdown / HTML body of the digest */
  content: string;
  bug_breakdown: DigestBugBreakdown;
  /** Alert IDs referenced in this digest */
  trend_alert_ids: string[];
  /** Whether the digest has been delivered to stakeholders */
  delivered: boolean;
  delivered_at: ISODateString | null;
  created_at: ISODateString;
}

// ---------------------------------------------------------------------------
// TeamSettings
// ---------------------------------------------------------------------------

export interface TeamSettings {
  id: string;
  team_id: string;
  /** Minimum classifier confidence threshold to auto-create a bug report */
  auto_approve_threshold: number;
  /** Minimum classifier confidence threshold to auto-reject */
  auto_reject_threshold: number;
  /** Deduplicate against bugs created within this many days */
  dedup_window_days: number;
  /** Similarity score [0, 1] above which a bug is treated as a duplicate */
  dedup_similarity_threshold: number;
  /** Monday.com board ID to create items on */
  monday_board_id: string | null;
  /** Monday.com group ID within the board */
  monday_group_id: string | null;
  /** Day of week (0 = Sunday … 6 = Saturday) to send the weekly digest */
  digest_day_of_week: number;
  /** Hour of day in UTC to send the weekly digest */
  digest_hour_utc: number;
  /** Whether to notify the team's integrations on new alerts */
  notify_on_alerts: boolean;
  /** Platform channel IDs to send alert notifications to */
  alert_notification_channels: string[];
  created_at: ISODateString;
  updated_at: ISODateString;
}
