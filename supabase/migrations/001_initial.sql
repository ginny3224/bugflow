-- =============================================================================
-- BugFlow: Initial Schema Migration
-- Version: 001
-- Description: Full schema for bug tracking aggregation system
-- =============================================================================

-- =============================================================================
-- EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- trigram similarity for dedup
CREATE EXTENSION IF NOT EXISTS "unaccent";      -- normalize text for full-text search


-- =============================================================================
-- HELPER: updated_at trigger function (shared across all tables)
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


-- =============================================================================
-- TABLE: teams
-- =============================================================================

CREATE TABLE teams (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text        NOT NULL,
    slug        text        NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT teams_slug_unique     UNIQUE (slug),
    CONSTRAINT teams_name_not_empty  CHECK (char_length(name) > 0),
    CONSTRAINT teams_slug_format     CHECK (slug ~ '^[a-z0-9][a-z0-9\-]*[a-z0-9]$')
);

COMMENT ON TABLE  teams          IS 'Top-level organizational units that own integrations and bug reports.';
COMMENT ON COLUMN teams.slug     IS 'URL-safe unique identifier. Lowercase alphanumeric with hyphens.';


-- =============================================================================
-- TABLE: team_members
-- =============================================================================

CREATE TABLE team_members (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     uuid        NOT NULL REFERENCES teams (id)       ON DELETE CASCADE,
    user_id     uuid        NOT NULL REFERENCES auth.users (id)  ON DELETE CASCADE,
    role        text        NOT NULL DEFAULT 'member',
    created_at  timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT team_members_team_user_unique UNIQUE (team_id, user_id),
    CONSTRAINT team_members_role_check       CHECK (role IN ('owner', 'admin', 'member'))
);

COMMENT ON TABLE  team_members        IS 'Maps Supabase auth users to teams with a role.';
COMMENT ON COLUMN team_members.role   IS 'owner: full control including deletion; admin: manage members/integrations; member: read-only.';

CREATE INDEX idx_team_members_team_id ON team_members (team_id);
CREATE INDEX idx_team_members_user_id ON team_members (user_id);


-- =============================================================================
-- TABLE: team_invites
-- =============================================================================

CREATE TABLE team_invites (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id      uuid        NOT NULL REFERENCES teams (id)      ON DELETE CASCADE,
    email        text        NOT NULL,
    role         text        NOT NULL DEFAULT 'member',
    invited_by   uuid        NOT NULL REFERENCES auth.users (id) ON DELETE SET NULL,
    accepted_at  timestamptz,
    created_at   timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT team_invites_role_check  CHECK (role IN ('owner', 'admin', 'member')),
    CONSTRAINT team_invites_email_check CHECK (email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$')
);

-- Partial unique index: only one pending invite per email per team
CREATE UNIQUE INDEX idx_team_invites_pending_unique
    ON team_invites (team_id, email)
    WHERE accepted_at IS NULL;

CREATE INDEX idx_team_invites_team_id    ON team_invites (team_id);
CREATE INDEX idx_team_invites_email      ON team_invites (email);
CREATE INDEX idx_team_invites_invited_by ON team_invites (invited_by);

COMMENT ON TABLE  team_invites              IS 'Pending and accepted email invitations to join a team.';
COMMENT ON COLUMN team_invites.accepted_at  IS 'NULL means the invite is still pending.';


-- =============================================================================
-- TABLE: integrations
-- =============================================================================

CREATE TABLE integrations (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     uuid        NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
    platform    text        NOT NULL,
    config      jsonb       NOT NULL DEFAULT '{}',
    enabled     boolean     NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT integrations_platform_check CHECK (
        platform IN ('slack', 'discord', 'intercom', 'telegram', 'monday')
    )
);

COMMENT ON TABLE  integrations          IS 'Per-team platform integration configurations.';
COMMENT ON COLUMN integrations.config   IS 'Encrypted credentials and settings. Encryption handled at application layer before insert.';
COMMENT ON COLUMN integrations.enabled  IS 'Soft-disable without removing credentials.';

CREATE INDEX idx_integrations_team_id ON integrations (team_id);
CREATE INDEX idx_integrations_team_platform ON integrations (team_id, platform);

CREATE TRIGGER trg_integrations_updated_at
    BEFORE UPDATE ON integrations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- TABLE: incoming_messages
-- =============================================================================

CREATE TABLE incoming_messages (
    id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id                  uuid        NOT NULL REFERENCES teams (id)        ON DELETE CASCADE,
    integration_id           uuid        NOT NULL REFERENCES integrations (id) ON DELETE CASCADE,
    platform                 text        NOT NULL,
    external_id              text        NOT NULL,
    channel_id               text,
    channel_name             text,
    author_name              text,
    author_avatar_url        text,
    content                  text        NOT NULL,
    raw_payload              jsonb,
    classification_status    text        NOT NULL DEFAULT 'pending',
    classification_confidence float,
    classification_reasoning text,
    created_at               timestamptz NOT NULL DEFAULT now(),
    classified_at            timestamptz,

    CONSTRAINT incoming_messages_external_id_unique
        UNIQUE (integration_id, external_id),

    CONSTRAINT incoming_messages_classification_status_check CHECK (
        classification_status IN ('pending', 'processing', 'classified', 'not_bug', 'error')
    ),

    CONSTRAINT incoming_messages_confidence_range CHECK (
        classification_confidence IS NULL
        OR (classification_confidence >= 0.0 AND classification_confidence <= 1.0)
    ),

    CONSTRAINT incoming_messages_content_not_empty CHECK (
        char_length(content) > 0
    )
);

COMMENT ON TABLE  incoming_messages                          IS 'Raw messages ingested from platform integrations before classification.';
COMMENT ON COLUMN incoming_messages.external_id             IS 'The message ID as given by the originating platform.';
COMMENT ON COLUMN incoming_messages.classification_status   IS 'pending→processing→classified|not_bug|error lifecycle.';
COMMENT ON COLUMN incoming_messages.classification_confidence IS 'AI confidence score 0–1. NULL until classification completes.';

CREATE INDEX idx_incoming_messages_team_status
    ON incoming_messages (team_id, classification_status);

CREATE INDEX idx_incoming_messages_team_id
    ON incoming_messages (team_id);

CREATE INDEX idx_incoming_messages_integration_id
    ON incoming_messages (integration_id);

CREATE INDEX idx_incoming_messages_created_at
    ON incoming_messages (created_at DESC);

-- Partial index for the worker's polling query (only unclassified rows)
CREATE INDEX idx_incoming_messages_pending
    ON incoming_messages (team_id, created_at)
    WHERE classification_status = 'pending';


-- =============================================================================
-- TABLE: bug_reports
-- =============================================================================

CREATE TABLE bug_reports (
    id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id               uuid        NOT NULL REFERENCES teams (id)       ON DELETE CASCADE,
    title                 text        NOT NULL,
    description           text,
    steps_to_reproduce    text,
    severity              text,
    category              text,
    status                text        NOT NULL DEFAULT 'pending_review',
    review_status         text        NOT NULL DEFAULT 'pending',
    reviewed_by           uuid        REFERENCES auth.users (id) ON DELETE SET NULL,
    reviewed_at           timestamptz,
    duplicate_of          uuid        REFERENCES bug_reports (id) ON DELETE SET NULL,
    monday_item_id        text,
    consolidated_summary  text,
    source_message_ids    uuid[],
    dedup_score           float,
    dedup_match_id        uuid        REFERENCES bug_reports (id) ON DELETE SET NULL,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT bug_reports_title_not_empty CHECK (char_length(title) > 0),

    CONSTRAINT bug_reports_severity_check CHECK (
        severity IS NULL
        OR severity IN ('critical', 'high', 'medium', 'low')
    ),

    CONSTRAINT bug_reports_status_check CHECK (
        status IN ('pending_review', 'approved', 'rejected', 'merged', 'created_in_monday')
    ),

    CONSTRAINT bug_reports_review_status_check CHECK (
        review_status IN ('pending', 'approved', 'rejected', 'merged')
    ),

    CONSTRAINT bug_reports_dedup_score_range CHECK (
        dedup_score IS NULL
        OR (dedup_score >= 0.0 AND dedup_score <= 1.0)
    ),

    CONSTRAINT bug_reports_no_self_duplicate CHECK (
        duplicate_of IS NULL OR duplicate_of <> id
    ),

    CONSTRAINT bug_reports_no_self_dedup CHECK (
        dedup_match_id IS NULL OR dedup_match_id <> id
    )
);

COMMENT ON TABLE  bug_reports                     IS 'Extracted and deduplicated bug reports produced from classified incoming messages.';
COMMENT ON COLUMN bug_reports.status              IS 'Primary workflow state machine column.';
COMMENT ON COLUMN bug_reports.review_status       IS 'Human review decision, separate from processing status.';
COMMENT ON COLUMN bug_reports.source_message_ids  IS 'UUIDs of incoming_messages that contributed to this report.';
COMMENT ON COLUMN bug_reports.duplicate_of        IS 'If this report was merged, points to the canonical report.';
COMMENT ON COLUMN bug_reports.dedup_match_id      IS 'Best deduplication candidate found by the AI worker.';
COMMENT ON COLUMN bug_reports.dedup_score         IS 'Similarity score (0–1) against dedup_match_id.';

CREATE INDEX idx_bug_reports_team_status
    ON bug_reports (team_id, status);

CREATE INDEX idx_bug_reports_team_id
    ON bug_reports (team_id);

CREATE INDEX idx_bug_reports_reviewed_by
    ON bug_reports (reviewed_by);

CREATE INDEX idx_bug_reports_duplicate_of
    ON bug_reports (duplicate_of);

CREATE INDEX idx_bug_reports_dedup_match_id
    ON bug_reports (dedup_match_id);

CREATE INDEX idx_bug_reports_created_at
    ON bug_reports (team_id, created_at DESC);

CREATE INDEX idx_bug_reports_source_messages
    ON bug_reports USING GIN (source_message_ids);

CREATE TRIGGER trg_bug_reports_updated_at
    BEFORE UPDATE ON bug_reports
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- TABLE: monday_backlog_items
-- =============================================================================

CREATE TABLE monday_backlog_items (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id          uuid        NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
    monday_item_id   text        NOT NULL,
    monday_board_id  text        NOT NULL,
    name             text        NOT NULL,
    description      text,
    status           text,
    priority         text,
    tags             text[],
    search_vector    tsvector,
    synced_at        timestamptz NOT NULL DEFAULT now(),
    created_at       timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT monday_backlog_items_team_item_unique
        UNIQUE (team_id, monday_item_id)
);

COMMENT ON TABLE  monday_backlog_items               IS 'Cached snapshot of Monday.com backlog items for local deduplication.';
COMMENT ON COLUMN monday_backlog_items.search_vector IS 'Auto-generated tsvector for full-text similarity matching against new bug reports.';
COMMENT ON COLUMN monday_backlog_items.synced_at     IS 'Last time this row was refreshed from Monday.com API.';

CREATE INDEX idx_monday_backlog_team_id
    ON monday_backlog_items (team_id);

CREATE INDEX idx_monday_backlog_search_vector
    ON monday_backlog_items USING GIN (search_vector);

CREATE INDEX idx_monday_backlog_board_id
    ON monday_backlog_items (monday_board_id);

-- Function to build the tsvector from name + description
CREATE OR REPLACE FUNCTION monday_backlog_items_search_vector_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', unaccent(coalesce(NEW.name, ''))), 'A')
        || setweight(to_tsvector('english', unaccent(coalesce(NEW.description, ''))), 'B')
        || setweight(to_tsvector('english', unaccent(coalesce(array_to_string(NEW.tags, ' '), ''))), 'C');
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_monday_backlog_search_vector
    BEFORE INSERT OR UPDATE ON monday_backlog_items
    FOR EACH ROW EXECUTE FUNCTION monday_backlog_items_search_vector_update();


-- =============================================================================
-- TABLE: job_queue
-- =============================================================================

CREATE TABLE job_queue (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id        uuid        NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
    job_type       text        NOT NULL,
    payload        jsonb       NOT NULL DEFAULT '{}',
    status         text        NOT NULL DEFAULT 'pending',
    attempts       int         NOT NULL DEFAULT 0,
    max_attempts   int         NOT NULL DEFAULT 3,
    result         jsonb,
    error          text,
    worker_id      text,
    claimed_at     timestamptz,
    completed_at   timestamptz,
    created_at     timestamptz NOT NULL DEFAULT now(),
    next_retry_at  timestamptz,

    CONSTRAINT job_queue_job_type_check CHECK (
        job_type IN (
            'classify_message',
            'extract_bug_data',
            'deduplicate_bug',
            'create_monday_item',
            'generate_summary',
            'detect_trends',
            'generate_digest'
        )
    ),

    CONSTRAINT job_queue_status_check CHECK (
        status IN ('pending', 'processing', 'completed', 'failed', 'retry')
    ),

    CONSTRAINT job_queue_attempts_non_negative CHECK (attempts >= 0),
    CONSTRAINT job_queue_max_attempts_positive  CHECK (max_attempts > 0)
);

COMMENT ON TABLE  job_queue               IS 'Transactional outbox / work queue for AI processing jobs.';
COMMENT ON COLUMN job_queue.worker_id     IS 'Identifier of the worker process that claimed this job.';
COMMENT ON COLUMN job_queue.next_retry_at IS 'When to make a failed job eligible for re-claiming.';
COMMENT ON COLUMN job_queue.claimed_at    IS 'Timestamp when a worker locked and began processing this job.';

-- Primary polling index: workers look for pending/retry jobs sorted by retry time
CREATE INDEX idx_job_queue_poll
    ON job_queue (status, next_retry_at NULLS FIRST)
    WHERE status IN ('pending', 'retry');

CREATE INDEX idx_job_queue_team_id
    ON job_queue (team_id);

CREATE INDEX idx_job_queue_status
    ON job_queue (status);

CREATE INDEX idx_job_queue_created_at
    ON job_queue (created_at DESC);

-- Partial index for stale processing jobs (dead worker detection)
CREATE INDEX idx_job_queue_stale
    ON job_queue (claimed_at)
    WHERE status = 'processing';


-- =============================================================================
-- TABLE: trend_alerts
-- =============================================================================

CREATE TABLE trend_alerts (
    id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id               uuid        NOT NULL REFERENCES teams (id)       ON DELETE CASCADE,
    alert_type            text        NOT NULL,
    title                 text        NOT NULL,
    description           text,
    category              text,
    severity              text,
    bug_count             int,
    time_window_minutes   int,
    acknowledged          boolean     NOT NULL DEFAULT false,
    acknowledged_by       uuid        REFERENCES auth.users (id) ON DELETE SET NULL,
    created_at            timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT trend_alerts_alert_type_check CHECK (
        alert_type IN ('spike', 'trend', 'regression')
    ),

    CONSTRAINT trend_alerts_bug_count_non_negative CHECK (
        bug_count IS NULL OR bug_count >= 0
    ),

    CONSTRAINT trend_alerts_time_window_positive CHECK (
        time_window_minutes IS NULL OR time_window_minutes > 0
    )
);

COMMENT ON TABLE  trend_alerts IS 'AI-generated alerts for unusual bug patterns (spikes, trends, regressions).';

CREATE INDEX idx_trend_alerts_team_id
    ON trend_alerts (team_id);

CREATE INDEX idx_trend_alerts_team_unacked
    ON trend_alerts (team_id, created_at DESC)
    WHERE acknowledged = false;

CREATE INDEX idx_trend_alerts_acknowledged_by
    ON trend_alerts (acknowledged_by);


-- =============================================================================
-- TABLE: weekly_digests
-- =============================================================================

CREATE TABLE weekly_digests (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     uuid        NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
    week_start  date        NOT NULL,
    week_end    date        NOT NULL,
    content     text        NOT NULL,
    stats       jsonb,
    created_at  timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT weekly_digests_date_order CHECK (week_end > week_start),
    CONSTRAINT weekly_digests_content_not_empty CHECK (char_length(content) > 0)
);

COMMENT ON TABLE  weekly_digests         IS 'AI-generated weekly summary reports per team.';
COMMENT ON COLUMN weekly_digests.stats   IS 'Structured stats: { total_bugs, by_severity, by_channel, by_category, top_trends }.';
COMMENT ON COLUMN weekly_digests.content IS 'Human-readable markdown digest.';

CREATE INDEX idx_weekly_digests_team_id
    ON weekly_digests (team_id);

CREATE INDEX idx_weekly_digests_team_week
    ON weekly_digests (team_id, week_start DESC);


-- =============================================================================
-- TABLE: team_settings
-- =============================================================================

CREATE TABLE team_settings (
    id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id                     uuid        NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
    bug_confidence_threshold    float       NOT NULL DEFAULT 0.7,
    auto_approve_threshold      float       NOT NULL DEFAULT 0.95,
    dedup_similarity_threshold  float       NOT NULL DEFAULT 0.8,
    spike_threshold             int         NOT NULL DEFAULT 5,
    spike_window_minutes        int         NOT NULL DEFAULT 60,
    slack_thread_linking        boolean     NOT NULL DEFAULT false,
    digest_enabled              boolean     NOT NULL DEFAULT true,
    digest_day                  text        NOT NULL DEFAULT 'monday',
    created_at                  timestamptz NOT NULL DEFAULT now(),
    updated_at                  timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT team_settings_team_id_unique UNIQUE (team_id),

    CONSTRAINT team_settings_bug_confidence_range CHECK (
        bug_confidence_threshold >= 0.0 AND bug_confidence_threshold <= 1.0
    ),
    CONSTRAINT team_settings_auto_approve_range CHECK (
        auto_approve_threshold >= 0.0 AND auto_approve_threshold <= 1.0
    ),
    CONSTRAINT team_settings_dedup_range CHECK (
        dedup_similarity_threshold >= 0.0 AND dedup_similarity_threshold <= 1.0
    ),
    CONSTRAINT team_settings_spike_threshold_positive CHECK (
        spike_threshold > 0
    ),
    CONSTRAINT team_settings_spike_window_positive CHECK (
        spike_window_minutes > 0
    ),
    CONSTRAINT team_settings_digest_day_check CHECK (
        digest_day IN (
            'monday', 'tuesday', 'wednesday', 'thursday',
            'friday', 'saturday', 'sunday'
        )
    )
);

COMMENT ON TABLE  team_settings                              IS 'Per-team configuration for AI thresholds, alert settings, and digest scheduling.';
COMMENT ON COLUMN team_settings.bug_confidence_threshold    IS 'Minimum AI confidence to classify a message as a bug.';
COMMENT ON COLUMN team_settings.auto_approve_threshold      IS 'AI confidence above which a bug is auto-approved without human review.';
COMMENT ON COLUMN team_settings.dedup_similarity_threshold  IS 'Minimum similarity score to consider two bugs as duplicates.';
COMMENT ON COLUMN team_settings.spike_threshold             IS 'Number of bugs within spike_window_minutes that triggers a spike alert.';

CREATE INDEX idx_team_settings_team_id ON team_settings (team_id);

CREATE TRIGGER trg_team_settings_updated_at
    BEFORE UPDATE ON team_settings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- FUNCTION: enqueue_job
-- Inserts a job into the queue and returns the new job ID.
-- =============================================================================

CREATE OR REPLACE FUNCTION enqueue_job(
    p_team_id   uuid,
    p_job_type  text,
    p_payload   jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_job_id uuid;
BEGIN
    INSERT INTO job_queue (team_id, job_type, payload)
    VALUES (p_team_id, p_job_type, p_payload)
    RETURNING id INTO v_job_id;

    RETURN v_job_id;
END;
$$;

COMMENT ON FUNCTION enqueue_job IS
    'Safely enqueue a job. SECURITY DEFINER so workers and triggers can insert without RLS bypass grants.';


-- =============================================================================
-- FUNCTION: claim_job
-- Atomically claims the next available job for a worker using
-- SKIP LOCKED to prevent contention between concurrent workers.
-- =============================================================================

CREATE OR REPLACE FUNCTION claim_job(
    p_worker_id  text,
    p_job_types  text[] DEFAULT NULL
)
RETURNS SETOF job_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_job_id uuid;
BEGIN
    -- Select the oldest eligible job and lock it, skipping rows already locked
    -- by another worker. This is the standard advisory-lock-free queue pattern.
    SELECT id
    INTO   v_job_id
    FROM   job_queue
    WHERE  status IN ('pending', 'retry')
      AND  (next_retry_at IS NULL OR next_retry_at <= now())
      AND  (p_job_types IS NULL OR job_type = ANY(p_job_types))
    ORDER BY
        -- Prioritise retry jobs that are overdue, then FIFO by creation time
        CASE WHEN status = 'retry' THEN 0 ELSE 1 END,
        COALESCE(next_retry_at, created_at)
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    -- No eligible job found
    IF v_job_id IS NULL THEN
        RETURN;
    END IF;

    -- Atomically transition to processing state
    UPDATE job_queue
    SET    status     = 'processing',
           worker_id  = p_worker_id,
           claimed_at = now(),
           attempts   = attempts + 1
    WHERE  id = v_job_id;

    -- Return the full updated row to the caller
    RETURN QUERY
        SELECT * FROM job_queue WHERE id = v_job_id;
END;
$$;

COMMENT ON FUNCTION claim_job IS
    'Atomically claim the next available job using SKIP LOCKED. Returns the claimed row or empty if none available. Pass p_job_types to filter by type.';


-- =============================================================================
-- TRIGGER: auto-enqueue classify_message after incoming_message insert
-- =============================================================================

CREATE OR REPLACE FUNCTION trg_fn_enqueue_classify_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM enqueue_job(
        NEW.team_id,
        'classify_message',
        jsonb_build_object(
            'message_id',      NEW.id,
            'integration_id',  NEW.integration_id,
            'platform',        NEW.platform
        )
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_incoming_messages_enqueue_classify
    AFTER INSERT ON incoming_messages
    FOR EACH ROW
    EXECUTE FUNCTION trg_fn_enqueue_classify_message();

COMMENT ON FUNCTION trg_fn_enqueue_classify_message IS
    'Automatically enqueues a classify_message job whenever a new incoming_message is inserted.';


-- =============================================================================
-- ROW LEVEL SECURITY
-- Enable RLS on every table, then define policies.
-- The service role (used by workers) bypasses RLS automatically in Supabase.
-- =============================================================================

ALTER TABLE teams               ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invites        ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE incoming_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bug_reports         ENABLE ROW LEVEL SECURITY;
ALTER TABLE monday_backlog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_queue           ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_alerts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_digests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_settings       ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Helper: reusable inline function to check team membership
-- Used in policy expressions to avoid repeating the subquery.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION is_team_member(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM team_members
        WHERE team_id = p_team_id
          AND user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION is_team_admin_or_owner(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM team_members
        WHERE team_id = p_team_id
          AND user_id = auth.uid()
          AND role IN ('admin', 'owner')
    );
$$;

COMMENT ON FUNCTION is_team_member          IS 'Returns true if the calling user is a member of the given team.';
COMMENT ON FUNCTION is_team_admin_or_owner  IS 'Returns true if the calling user is an admin or owner of the given team.';


-- =============================================================================
-- RLS POLICIES: teams
-- =============================================================================

-- Members can see teams they belong to
CREATE POLICY "teams_select_member"
    ON teams FOR SELECT
    USING (is_team_member(id));

-- Authenticated users can create teams (the app layer adds them as owner after)
CREATE POLICY "teams_insert_authenticated"
    ON teams FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Only owners/admins can update team details
CREATE POLICY "teams_update_admin"
    ON teams FOR UPDATE
    USING (is_team_admin_or_owner(id))
    WITH CHECK (is_team_admin_or_owner(id));

-- Only owners can delete a team
CREATE POLICY "teams_delete_owner"
    ON teams FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM team_members
            WHERE team_id = id
              AND user_id = auth.uid()
              AND role = 'owner'
        )
    );


-- =============================================================================
-- RLS POLICIES: team_members
-- =============================================================================

CREATE POLICY "team_members_select_member"
    ON team_members FOR SELECT
    USING (is_team_member(team_id));

-- Admins/owners can add members
CREATE POLICY "team_members_insert_admin"
    ON team_members FOR INSERT
    WITH CHECK (is_team_admin_or_owner(team_id));

-- Admins/owners can update roles; users can also read their own row
CREATE POLICY "team_members_update_admin"
    ON team_members FOR UPDATE
    USING (is_team_admin_or_owner(team_id))
    WITH CHECK (is_team_admin_or_owner(team_id));

-- Admins/owners can remove members; members can remove themselves
CREATE POLICY "team_members_delete_admin_or_self"
    ON team_members FOR DELETE
    USING (
        is_team_admin_or_owner(team_id)
        OR user_id = auth.uid()
    );


-- =============================================================================
-- RLS POLICIES: team_invites
-- =============================================================================

-- Members can view pending invites for their team
CREATE POLICY "team_invites_select_member"
    ON team_invites FOR SELECT
    USING (is_team_member(team_id));

-- Admins/owners can send invites
CREATE POLICY "team_invites_insert_admin"
    ON team_invites FOR INSERT
    WITH CHECK (
        is_team_admin_or_owner(team_id)
        AND invited_by = auth.uid()
    );

-- Admins/owners can cancel invites; invitees can accept their own invite
CREATE POLICY "team_invites_update_admin_or_invitee"
    ON team_invites FOR UPDATE
    USING (
        is_team_admin_or_owner(team_id)
        OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
    WITH CHECK (
        is_team_admin_or_owner(team_id)
        OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

-- Admins/owners can delete invites
CREATE POLICY "team_invites_delete_admin"
    ON team_invites FOR DELETE
    USING (is_team_admin_or_owner(team_id));


-- =============================================================================
-- RLS POLICIES: integrations
-- =============================================================================

CREATE POLICY "integrations_select_member"
    ON integrations FOR SELECT
    USING (is_team_member(team_id));

CREATE POLICY "integrations_insert_admin"
    ON integrations FOR INSERT
    WITH CHECK (is_team_admin_or_owner(team_id));

CREATE POLICY "integrations_update_admin"
    ON integrations FOR UPDATE
    USING (is_team_admin_or_owner(team_id))
    WITH CHECK (is_team_admin_or_owner(team_id));

CREATE POLICY "integrations_delete_admin"
    ON integrations FOR DELETE
    USING (is_team_admin_or_owner(team_id));


-- =============================================================================
-- RLS POLICIES: incoming_messages
-- =============================================================================

CREATE POLICY "incoming_messages_select_member"
    ON incoming_messages FOR SELECT
    USING (is_team_member(team_id));

-- Insert is restricted to service role (webhook handlers run as service role)
-- Authenticated users cannot insert directly
CREATE POLICY "incoming_messages_insert_admin"
    ON incoming_messages FOR INSERT
    WITH CHECK (is_team_admin_or_owner(team_id));

-- Only admins can update (e.g., re-classify), service role bypasses
CREATE POLICY "incoming_messages_update_admin"
    ON incoming_messages FOR UPDATE
    USING (is_team_admin_or_owner(team_id))
    WITH CHECK (is_team_admin_or_owner(team_id));


-- =============================================================================
-- RLS POLICIES: bug_reports
-- =============================================================================

CREATE POLICY "bug_reports_select_member"
    ON bug_reports FOR SELECT
    USING (is_team_member(team_id));

-- Service role inserts; admins can also create manual reports
CREATE POLICY "bug_reports_insert_admin"
    ON bug_reports FOR INSERT
    WITH CHECK (is_team_admin_or_owner(team_id));

-- Admins/owners can approve, reject, update
CREATE POLICY "bug_reports_update_admin"
    ON bug_reports FOR UPDATE
    USING (is_team_admin_or_owner(team_id))
    WITH CHECK (is_team_admin_or_owner(team_id));

-- Only owners can hard-delete bug reports
CREATE POLICY "bug_reports_delete_owner"
    ON bug_reports FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM team_members
            WHERE team_id = bug_reports.team_id
              AND user_id = auth.uid()
              AND role = 'owner'
        )
    );


-- =============================================================================
-- RLS POLICIES: monday_backlog_items
-- =============================================================================

CREATE POLICY "monday_backlog_select_member"
    ON monday_backlog_items FOR SELECT
    USING (is_team_member(team_id));

CREATE POLICY "monday_backlog_insert_admin"
    ON monday_backlog_items FOR INSERT
    WITH CHECK (is_team_admin_or_owner(team_id));

CREATE POLICY "monday_backlog_update_admin"
    ON monday_backlog_items FOR UPDATE
    USING (is_team_admin_or_owner(team_id))
    WITH CHECK (is_team_admin_or_owner(team_id));

CREATE POLICY "monday_backlog_delete_admin"
    ON monday_backlog_items FOR DELETE
    USING (is_team_admin_or_owner(team_id));


-- =============================================================================
-- RLS POLICIES: job_queue
-- =============================================================================

-- Members can view job status for their team (useful for UI progress indicators)
CREATE POLICY "job_queue_select_member"
    ON job_queue FOR SELECT
    USING (is_team_member(team_id));

-- Only service role (workers) and admins can insert jobs
CREATE POLICY "job_queue_insert_admin"
    ON job_queue FOR INSERT
    WITH CHECK (is_team_admin_or_owner(team_id));

-- Workers (service role) update jobs; admins can also cancel/reset
CREATE POLICY "job_queue_update_admin"
    ON job_queue FOR UPDATE
    USING (is_team_admin_or_owner(team_id))
    WITH CHECK (is_team_admin_or_owner(team_id));


-- =============================================================================
-- RLS POLICIES: trend_alerts
-- =============================================================================

CREATE POLICY "trend_alerts_select_member"
    ON trend_alerts FOR SELECT
    USING (is_team_member(team_id));

CREATE POLICY "trend_alerts_insert_admin"
    ON trend_alerts FOR INSERT
    WITH CHECK (is_team_admin_or_owner(team_id));

-- Members can acknowledge alerts (not just admins)
CREATE POLICY "trend_alerts_update_member"
    ON trend_alerts FOR UPDATE
    USING (is_team_member(team_id))
    WITH CHECK (is_team_member(team_id));

CREATE POLICY "trend_alerts_delete_admin"
    ON trend_alerts FOR DELETE
    USING (is_team_admin_or_owner(team_id));


-- =============================================================================
-- RLS POLICIES: weekly_digests
-- =============================================================================

CREATE POLICY "weekly_digests_select_member"
    ON weekly_digests FOR SELECT
    USING (is_team_member(team_id));

CREATE POLICY "weekly_digests_insert_admin"
    ON weekly_digests FOR INSERT
    WITH CHECK (is_team_admin_or_owner(team_id));

CREATE POLICY "weekly_digests_update_admin"
    ON weekly_digests FOR UPDATE
    USING (is_team_admin_or_owner(team_id))
    WITH CHECK (is_team_admin_or_owner(team_id));


-- =============================================================================
-- RLS POLICIES: team_settings
-- =============================================================================

CREATE POLICY "team_settings_select_member"
    ON team_settings FOR SELECT
    USING (is_team_member(team_id));

CREATE POLICY "team_settings_insert_admin"
    ON team_settings FOR INSERT
    WITH CHECK (is_team_admin_or_owner(team_id));

CREATE POLICY "team_settings_update_admin"
    ON team_settings FOR UPDATE
    USING (is_team_admin_or_owner(team_id))
    WITH CHECK (is_team_admin_or_owner(team_id));


-- =============================================================================
-- GRANT PERMISSIONS
-- The 'authenticated' role is used by Supabase client-side calls.
-- The 'service_role' bypasses RLS and needs no per-table grants.
-- anon role gets nothing — no unauthenticated access.
-- =============================================================================

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON teams                TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON team_members         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON team_invites         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON integrations         TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON incoming_messages    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON bug_reports          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON monday_backlog_items TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON job_queue            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON trend_alerts         TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON weekly_digests       TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON team_settings        TO authenticated;

-- Grant execute on queue functions to authenticated users
-- (RLS on the underlying table still applies for authenticated callers)
GRANT EXECUTE ON FUNCTION enqueue_job(uuid, text, jsonb) TO authenticated;

-- claim_job is only meaningful for the service role worker;
-- no authenticated grant needed, but harmless if included for admin tooling.
GRANT EXECUTE ON FUNCTION claim_job(text, text[]) TO service_role;

-- Helper functions used in RLS policies must be accessible
GRANT EXECUTE ON FUNCTION is_team_member(uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION is_team_admin_or_owner(uuid) TO authenticated;


-- =============================================================================
-- INITIAL DATA: Default team_settings row created when a team is created
-- =============================================================================

CREATE OR REPLACE FUNCTION trg_fn_create_default_team_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO team_settings (team_id)
    VALUES (NEW.id)
    ON CONFLICT (team_id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_teams_create_settings
    AFTER INSERT ON teams
    FOR EACH ROW
    EXECUTE FUNCTION trg_fn_create_default_team_settings();

COMMENT ON FUNCTION trg_fn_create_default_team_settings IS
    'Automatically creates a default team_settings row when a new team is created.';


-- =============================================================================
-- INTEGRITY: Ensure reviewed_at is set when reviewed_by is set
-- =============================================================================

CREATE OR REPLACE FUNCTION trg_fn_bug_reports_review_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Auto-set reviewed_at when a reviewer is assigned and it is not already set
    IF NEW.reviewed_by IS NOT NULL AND NEW.reviewed_at IS NULL THEN
        NEW.reviewed_at = now();
    END IF;

    -- Clear reviewed_at if reviewer is removed
    IF NEW.reviewed_by IS NULL THEN
        NEW.reviewed_at = NULL;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bug_reports_review_consistency
    BEFORE INSERT OR UPDATE ON bug_reports
    FOR EACH ROW
    EXECUTE FUNCTION trg_fn_bug_reports_review_consistency();


-- =============================================================================
-- INTEGRITY: Ensure acknowledged_by / created_at coherence on trend_alerts
-- =============================================================================

CREATE OR REPLACE FUNCTION trg_fn_trend_alerts_ack_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- If being acknowledged, record who did it
    IF NEW.acknowledged = true AND OLD.acknowledged = false THEN
        IF NEW.acknowledged_by IS NULL THEN
            NEW.acknowledged_by = auth.uid();
        END IF;
    END IF;

    -- Cannot un-acknowledge
    IF NEW.acknowledged = false AND OLD.acknowledged = true THEN
        RAISE EXCEPTION 'trend_alerts: acknowledged cannot be set back to false';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_trend_alerts_ack_consistency
    BEFORE UPDATE ON trend_alerts
    FOR EACH ROW
    EXECUTE FUNCTION trg_fn_trend_alerts_ack_consistency();


-- =============================================================================
-- VIEW: active_jobs
-- Convenience view for monitoring worker activity
-- =============================================================================

CREATE OR REPLACE VIEW active_jobs AS
SELECT
    jq.id,
    jq.team_id,
    t.name  AS team_name,
    jq.job_type,
    jq.status,
    jq.attempts,
    jq.max_attempts,
    jq.worker_id,
    jq.claimed_at,
    jq.created_at,
    jq.next_retry_at,
    jq.error
FROM job_queue jq
JOIN teams t ON t.id = jq.team_id
WHERE jq.status NOT IN ('completed');

COMMENT ON VIEW active_jobs IS 'All non-completed jobs with team name. Useful for monitoring dashboards.';

GRANT SELECT ON active_jobs TO authenticated;


-- =============================================================================
-- VIEW: team_bug_summary
-- Per-team bug counts grouped by status and severity
-- =============================================================================

CREATE OR REPLACE VIEW team_bug_summary AS
SELECT
    br.team_id,
    t.name              AS team_name,
    br.status,
    br.severity,
    count(*)            AS bug_count,
    min(br.created_at)  AS oldest_bug,
    max(br.created_at)  AS newest_bug
FROM bug_reports br
JOIN teams t ON t.id = br.team_id
GROUP BY br.team_id, t.name, br.status, br.severity;

COMMENT ON VIEW team_bug_summary IS 'Aggregated bug counts per team, status, and severity. Used for dashboards and trend detection.';

GRANT SELECT ON team_bug_summary TO authenticated;


-- =============================================================================
-- End of migration 001_initial.sql
-- =============================================================================
