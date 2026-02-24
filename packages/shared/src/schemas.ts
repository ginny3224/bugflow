/**
 * BugFlow Shared Zod Schemas
 * Runtime-validated schemas that mirror the types in types.ts.
 * Use z.infer<typeof Schema> to derive types from schemas where needed.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Re-usable primitives
// ---------------------------------------------------------------------------

export const isoDateStringSchema = z.string().datetime({ offset: true });

const uuidSchema = z.string().uuid();

// ---------------------------------------------------------------------------
// Platform
// ---------------------------------------------------------------------------

export const platformSchema = z.enum([
  'slack',
  'discord',
  'intercom',
  'telegram',
  'monday',
]);

export type PlatformSchema = z.infer<typeof platformSchema>;

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

export const teamRoleSchema = z.enum(['owner', 'admin', 'member']);

export const teamSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/),
  created_at: isoDateStringSchema,
  updated_at: isoDateStringSchema,
});

export type TeamSchema = z.infer<typeof teamSchema>;

export const teamMemberSchema = z.object({
  id: uuidSchema,
  team_id: uuidSchema,
  user_id: uuidSchema,
  role: teamRoleSchema,
  email: z.string().email(),
  display_name: z.string().max(120).nullable(),
  avatar_url: z.string().url().nullable(),
  joined_at: isoDateStringSchema,
});

export type TeamMemberSchema = z.infer<typeof teamMemberSchema>;

export const inviteStatusSchema = z.enum([
  'pending',
  'accepted',
  'expired',
  'revoked',
]);

export const teamInviteSchema = z.object({
  id: uuidSchema,
  team_id: uuidSchema,
  invited_by_user_id: uuidSchema,
  email: z.string().email(),
  role: teamRoleSchema,
  status: inviteStatusSchema,
  token: z.string().min(32),
  expires_at: isoDateStringSchema,
  created_at: isoDateStringSchema,
  accepted_at: isoDateStringSchema.nullable(),
});

export type TeamInviteSchema = z.infer<typeof teamInviteSchema>;

// ---------------------------------------------------------------------------
// Integration
// ---------------------------------------------------------------------------

export const integrationSchema = z.object({
  id: uuidSchema,
  team_id: uuidSchema,
  platform: platformSchema,
  name: z.string().min(1).max(120),
  config: z.record(z.unknown()),
  is_active: z.boolean(),
  created_at: isoDateStringSchema,
  updated_at: isoDateStringSchema,
});

export type IntegrationSchema = z.infer<typeof integrationSchema>;

// ---------------------------------------------------------------------------
// IncomingMessage
// ---------------------------------------------------------------------------

export const classificationStatusSchema = z.enum([
  'pending',
  'processing',
  'classified',
  'not_bug',
  'error',
]);

export const incomingMessageSchema = z.object({
  id: uuidSchema,
  team_id: uuidSchema,
  integration_id: uuidSchema,
  platform: platformSchema,
  external_id: z.string().min(1),
  channel_id: z.string().min(1),
  sender_name: z.string().max(200).nullable(),
  content: z.string().min(1),
  raw_payload: z.record(z.unknown()),
  classification_status: classificationStatusSchema,
  classification_confidence: z.number().min(0).max(1).nullable(),
  classification_reasoning: z.string().nullable(),
  received_at: isoDateStringSchema,
  classified_at: isoDateStringSchema.nullable(),
});

export type IncomingMessageSchema = z.infer<typeof incomingMessageSchema>;

// ---------------------------------------------------------------------------
// BugReport
// ---------------------------------------------------------------------------

export const bugStatusSchema = z.enum([
  'pending_review',
  'approved',
  'rejected',
  'merged',
  'created_in_monday',
]);

export const bugSeveritySchema = z.enum(['critical', 'high', 'medium', 'low']);

export const bugCategorySchema = z.enum([
  'ui_ux',
  'performance',
  'data_loss',
  'security',
  'crash',
  'api',
  'authentication',
  'integration',
  'other',
]);

export const bugReportSchema = z.object({
  id: uuidSchema,
  team_id: uuidSchema,
  incoming_message_id: uuidSchema,
  monday_item_id: z.string().nullable(),
  title: z.string().min(1).max(300),
  description: z.string().min(1),
  steps_to_reproduce: z.string().nullable(),
  severity: bugSeveritySchema,
  category: bugCategorySchema,
  status: bugStatusSchema,
  merged_into_id: uuidSchema.nullable(),
  duplicate_similarity_score: z.number().min(0).max(1).nullable(),
  reviewed_by_user_id: uuidSchema.nullable(),
  reviewed_at: isoDateStringSchema.nullable(),
  created_at: isoDateStringSchema,
  updated_at: isoDateStringSchema,
});

export type BugReportSchema = z.infer<typeof bugReportSchema>;

// ---------------------------------------------------------------------------
// MondayBacklogItem
// ---------------------------------------------------------------------------

export const mondayBacklogItemSchema = z.object({
  id: uuidSchema,
  team_id: uuidSchema,
  bug_report_id: uuidSchema,
  monday_board_id: z.string().min(1),
  monday_item_id: z.string().min(1),
  monday_item_name: z.string().min(1),
  monday_column_values: z.record(z.unknown()),
  monday_item_url: z.string().url().nullable(),
  synced_at: isoDateStringSchema,
  created_at: isoDateStringSchema,
});

export type MondayBacklogItemSchema = z.infer<typeof mondayBacklogItemSchema>;

// ---------------------------------------------------------------------------
// Job
// ---------------------------------------------------------------------------

export const jobTypeSchema = z.enum([
  'classify_message',
  'extract_bug_data',
  'deduplicate_bug',
  'create_monday_item',
  'generate_summary',
  'detect_trends',
  'generate_digest',
]);

export const jobStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
  'retry',
]);

export const jobSchema = z.object({
  id: uuidSchema,
  team_id: uuidSchema,
  job_type: jobTypeSchema,
  status: jobStatusSchema,
  payload: z.record(z.unknown()),
  result: z.record(z.unknown()).nullable(),
  error_message: z.string().nullable(),
  attempt_count: z.number().int().min(0),
  max_attempts: z.number().int().min(1),
  scheduled_at: isoDateStringSchema,
  started_at: isoDateStringSchema.nullable(),
  completed_at: isoDateStringSchema.nullable(),
  created_at: isoDateStringSchema,
  updated_at: isoDateStringSchema,
});

export type JobSchema = z.infer<typeof jobSchema>;

// ---------------------------------------------------------------------------
// TrendAlert
// ---------------------------------------------------------------------------

export const alertTypeSchema = z.enum(['spike', 'trend', 'regression']);

export const trendAlertSchema = z.object({
  id: uuidSchema,
  team_id: uuidSchema,
  alert_type: alertTypeSchema,
  category: bugCategorySchema.nullable(),
  severity: bugSeveritySchema.nullable(),
  summary: z.string().min(1).max(500),
  details: z.string().min(1),
  metrics: z.record(z.unknown()),
  bug_count: z.number().int().min(0),
  window_start: isoDateStringSchema,
  window_end: isoDateStringSchema,
  acknowledged: z.boolean(),
  acknowledged_by_user_id: uuidSchema.nullable(),
  acknowledged_at: isoDateStringSchema.nullable(),
  created_at: isoDateStringSchema,
});

export type TrendAlertSchema = z.infer<typeof trendAlertSchema>;

// ---------------------------------------------------------------------------
// WeeklyDigest
// ---------------------------------------------------------------------------

export const digestBugBreakdownSchema = z.object({
  total: z.number().int().min(0),
  by_severity: z.object({
    critical: z.number().int().min(0),
    high: z.number().int().min(0),
    medium: z.number().int().min(0),
    low: z.number().int().min(0),
  }),
  by_category: z.object({
    ui_ux: z.number().int().min(0),
    performance: z.number().int().min(0),
    data_loss: z.number().int().min(0),
    security: z.number().int().min(0),
    crash: z.number().int().min(0),
    api: z.number().int().min(0),
    authentication: z.number().int().min(0),
    integration: z.number().int().min(0),
    other: z.number().int().min(0),
  }),
  by_status: z.object({
    pending_review: z.number().int().min(0),
    approved: z.number().int().min(0),
    rejected: z.number().int().min(0),
    merged: z.number().int().min(0),
    created_in_monday: z.number().int().min(0),
  }),
});

export type DigestBugBreakdownSchema = z.infer<typeof digestBugBreakdownSchema>;

export const weeklyDigestSchema = z.object({
  id: uuidSchema,
  team_id: uuidSchema,
  week_label: z.string().regex(/^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/),
  week_start: isoDateStringSchema,
  week_end: isoDateStringSchema,
  content: z.string().min(1),
  bug_breakdown: digestBugBreakdownSchema,
  trend_alert_ids: z.array(uuidSchema),
  delivered: z.boolean(),
  delivered_at: isoDateStringSchema.nullable(),
  created_at: isoDateStringSchema,
});

export type WeeklyDigestSchema = z.infer<typeof weeklyDigestSchema>;

// ---------------------------------------------------------------------------
// TeamSettings
// ---------------------------------------------------------------------------

export const teamSettingsSchema = z.object({
  id: uuidSchema,
  team_id: uuidSchema,
  auto_approve_threshold: z.number().min(0).max(1),
  auto_reject_threshold: z.number().min(0).max(1),
  dedup_window_days: z.number().int().min(1).max(365),
  dedup_similarity_threshold: z.number().min(0).max(1),
  monday_board_id: z.string().nullable(),
  monday_group_id: z.string().nullable(),
  digest_day_of_week: z.number().int().min(0).max(6),
  digest_hour_utc: z.number().int().min(0).max(23),
  notify_on_alerts: z.boolean(),
  alert_notification_channels: z.array(z.string()),
  created_at: isoDateStringSchema,
  updated_at: isoDateStringSchema,
});

export type TeamSettingsSchema = z.infer<typeof teamSettingsSchema>;

// ---------------------------------------------------------------------------
// Webhook payloads per platform
// ---------------------------------------------------------------------------

export const slackWebhookPayloadSchema = z.object({
  token: z.string().optional(),
  team_id: z.string(),
  api_app_id: z.string().optional(),
  event: z
    .object({
      type: z.string(),
      text: z.string().optional(),
      user: z.string().optional(),
      ts: z.string().optional(),
      channel: z.string().optional(),
      thread_ts: z.string().optional(),
    })
    .optional(),
  type: z.string(),
  event_id: z.string().optional(),
  event_time: z.number().optional(),
  /** URL verification challenge */
  challenge: z.string().optional(),
});

export type SlackWebhookPayload = z.infer<typeof slackWebhookPayloadSchema>;

export const discordWebhookPayloadSchema = z.object({
  id: z.string(),
  type: z.number().int(),
  channel_id: z.string().optional(),
  guild_id: z.string().optional(),
  author: z
    .object({
      id: z.string(),
      username: z.string(),
      discriminator: z.string().optional(),
      global_name: z.string().nullable().optional(),
    })
    .optional(),
  content: z.string().optional(),
  timestamp: z.string().optional(),
  thread: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
});

export type DiscordWebhookPayload = z.infer<typeof discordWebhookPayloadSchema>;

export const intercomWebhookPayloadSchema = z.object({
  type: z.literal('notification_event'),
  app_id: z.string(),
  data: z.object({
    type: z.literal('notification_event_data'),
    item: z.object({
      type: z.string(),
      id: z.string(),
      body: z.string().optional(),
      author: z
        .object({
          type: z.string(),
          id: z.string(),
          name: z.string().nullable().optional(),
          email: z.string().optional(),
        })
        .optional(),
      conversation_id: z.string().optional(),
    }),
  }),
  topic: z.string(),
  created_at: z.number(),
  delivery_status: z.string().optional(),
  delivery_attempts: z.number().optional(),
  first_sent_at: z.number().optional(),
  self: z.string().optional(),
});

export type IntercomWebhookPayload = z.infer<
  typeof intercomWebhookPayloadSchema
>;

export const telegramWebhookPayloadSchema = z.object({
  update_id: z.number().int(),
  message: z
    .object({
      message_id: z.number().int(),
      from: z
        .object({
          id: z.number().int(),
          is_bot: z.boolean(),
          first_name: z.string(),
          last_name: z.string().optional(),
          username: z.string().optional(),
        })
        .optional(),
      chat: z.object({
        id: z.number(),
        type: z.enum(['private', 'group', 'supergroup', 'channel']),
        title: z.string().optional(),
        username: z.string().optional(),
      }),
      date: z.number().int(),
      text: z.string().optional(),
      reply_to_message: z
        .object({
          message_id: z.number().int(),
          text: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  edited_message: z
    .object({
      message_id: z.number().int(),
      text: z.string().optional(),
    })
    .optional(),
});

export type TelegramWebhookPayload = z.infer<
  typeof telegramWebhookPayloadSchema
>;

/** Monday.com sends webhook events for board/item changes */
export const mondayWebhookPayloadSchema = z.object({
  event: z.object({
    type: z.string(),
    userId: z.number().int().optional(),
    boardId: z.number().int().optional(),
    itemId: z.number().int().optional(),
    groupId: z.string().optional(),
    pulseName: z.string().optional(),
    columnId: z.string().optional(),
    value: z.unknown().optional(),
    previousValue: z.unknown().optional(),
    columnType: z.string().optional(),
    changedAt: z.number().optional(),
  }),
  challenge: z.string().optional(),
});

export type MondayWebhookPayload = z.infer<typeof mondayWebhookPayloadSchema>;

/** Discriminated union of all webhook payload types */
export const webhookPayloadSchema = z.discriminatedUnion('_platform', [
  slackWebhookPayloadSchema.extend({ _platform: z.literal('slack') }),
  discordWebhookPayloadSchema.extend({ _platform: z.literal('discord') }),
  intercomWebhookPayloadSchema.extend({ _platform: z.literal('intercom') }),
  telegramWebhookPayloadSchema.extend({ _platform: z.literal('telegram') }),
  mondayWebhookPayloadSchema.extend({ _platform: z.literal('monday') }),
]);

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;

// ---------------------------------------------------------------------------
// AI pipeline result schemas
// ---------------------------------------------------------------------------

export const classificationResultSchema = z.object({
  is_bug: z.boolean(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1),
});

export type ClassificationResult = z.infer<typeof classificationResultSchema>;

export const bugExtractionResultSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().min(1),
  steps_to_reproduce: z.string().nullable(),
  severity: bugSeveritySchema,
  category: bugCategorySchema,
});

export type BugExtractionResult = z.infer<typeof bugExtractionResultSchema>;

export const dedupResultSchema = z.object({
  is_duplicate: z.boolean(),
  /** ID of the existing BugReport this duplicates, present when is_duplicate is true */
  match_id: z.string().uuid().optional(),
  similarity_score: z.number().min(0).max(1),
  reasoning: z.string().min(1),
});

export type DedupResult = z.infer<typeof dedupResultSchema>;
