/**
 * POST /api/webhooks/slack
 *
 * Handles Slack Events API deliveries:
 *  - url_verification: returns the challenge immediately.
 *  - event_callback / message: inserts into incoming_messages.
 *  - event_callback / reaction_added: handles :bug: reactions.
 *
 * Slack signature verification is performed on every request using
 * HMAC-SHA256 over "v0:<timestamp>:<raw body>" with the signing secret
 * retrieved from the matching integration's config.
 *
 * Slack requires a 200 response within 3 seconds. We therefore respond
 * immediately and let the worker pick up the job asynchronously.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { adminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Verify the Slack request signature.
 * Ref: https://api.slack.com/authentication/verifying-requests-from-slack
 */
function verifySlackSignature(
  signingSecret: string,
  signature: string,
  timestamp: string,
  rawBody: string,
): boolean {
  // Reject requests older than 5 minutes to prevent replay attacks.
  const requestAge = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (requestAge > 300) return false

  const baseString = `v0:${timestamp}:${rawBody}`
  const hmac = createHmac('sha256', signingSecret)
    .update(baseString)
    .digest('hex')
  const expected = `v0=${hmac}`

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Read the raw body once — needed for both signature verification and parsing.
  const rawBody = await request.text()

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Handle url_verification challenge without signature check
  // (Slack sends this before a signing secret is confirmed).
  if (payload.type === 'url_verification') {
    return NextResponse.json({ challenge: payload.challenge })
  }

  // All other event types require a valid team_id to look up the signing secret.
  const slackTeamId = payload.team_id as string | undefined
  if (!slackTeamId) {
    return NextResponse.json({ error: 'Missing team_id' }, { status: 400 })
  }

  // Fetch the matching Slack integration for this Slack workspace.
  const { data: integration, error: integrationError } = await adminClient
    .from('integrations')
    .select('id, team_id, config')
    .eq('platform', 'slack')
    .eq('is_active', true)
    .filter('config->>slack_team_id', 'eq', slackTeamId)
    .maybeSingle()

  if (integrationError) {
    console.error('[webhooks/slack] integration lookup error:', integrationError.message)
    // Return 200 so Slack does not retry endlessly.
    return NextResponse.json({ ok: true })
  }

  if (!integration) {
    // Unknown workspace — return 200 silently.
    return NextResponse.json({ ok: true })
  }

  const config = integration.config as Record<string, string>
  const signingSecret = config.signing_secret

  if (!signingSecret) {
    console.error('[webhooks/slack] integration is missing signing_secret', integration.id)
    return NextResponse.json({ ok: true })
  }

  // Verify the request signature.
  const signature = request.headers.get('X-Slack-Signature') ?? ''
  const timestamp = request.headers.get('X-Slack-Request-Timestamp') ?? ''

  if (!verifySlackSignature(signingSecret, signature, timestamp, rawBody)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Handle event_callback.
  if (payload.type !== 'event_callback') {
    return NextResponse.json({ ok: true })
  }

  const event = payload.event as Record<string, unknown> | undefined
  if (!event) {
    return NextResponse.json({ ok: true })
  }

  const eventType = event.type as string

  if (eventType === 'message') {
    // Ignore bot messages and message_changed subtypes to avoid loops.
    if (event.bot_id || event.subtype) {
      return NextResponse.json({ ok: true })
    }

    const externalId = (event.ts as string | undefined) ?? `${Date.now()}`
    const channelId = (event.channel as string | undefined) ?? ''
    const content = (event.text as string | undefined) ?? ''
    const senderName = (event.user as string | undefined) ?? null

    if (!content.trim()) {
      return NextResponse.json({ ok: true })
    }

    const { error: insertError } = await adminClient
      .from('incoming_messages')
      .insert({
        team_id: integration.team_id,
        integration_id: integration.id,
        platform: 'slack',
        external_id: externalId,
        channel_id: channelId,
        sender_name: senderName,
        content,
        raw_payload: payload,
        classification_status: 'pending',
        received_at: new Date().toISOString(),
      })

    if (insertError) {
      console.error('[webhooks/slack] insert error:', insertError.message)
    }
  } else if (eventType === 'reaction_added') {
    const reaction = event.reaction as string | undefined

    // Only process :bug: reactions.
    if (reaction !== 'bug') {
      return NextResponse.json({ ok: true })
    }

    const item = event.item as Record<string, unknown> | undefined
    const messageTs = item?.ts as string | undefined
    const channelId = item?.channel as string | undefined

    if (!messageTs || !channelId) {
      return NextResponse.json({ ok: true })
    }

    // Check whether we already ingested this message.
    const { data: existing } = await adminClient
      .from('incoming_messages')
      .select('id')
      .eq('team_id', integration.team_id)
      .eq('platform', 'slack')
      .eq('external_id', messageTs)
      .maybeSingle()

    if (!existing) {
      // Insert a stub; the worker will enrich it or the raw payload suffices.
      const { error: insertError } = await adminClient
        .from('incoming_messages')
        .insert({
          team_id: integration.team_id,
          integration_id: integration.id,
          platform: 'slack',
          external_id: messageTs,
          channel_id: channelId,
          sender_name: null,
          content: `[reaction:bug] on message ${messageTs}`,
          raw_payload: payload,
          classification_status: 'pending',
          received_at: new Date().toISOString(),
        })

      if (insertError) {
        console.error('[webhooks/slack] reaction insert error:', insertError.message)
      }
    }
  }

  return NextResponse.json({ ok: true })
}
