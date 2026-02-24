/**
 * POST /api/webhooks/intercom
 *
 * Handles Intercom webhook notifications for:
 *  - conversation.user.replied
 *  - conversation.admin.replied
 *
 * Signature verification uses HMAC-SHA1 over the raw body with the client
 * secret from the matching integration config. Intercom sends the digest in
 * the `X-Hub-Signature` header as `sha1=<hex>`.
 *
 * Returns 200 immediately; the worker classifies the message asynchronously.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { adminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function verifyIntercomSignature(
  clientSecret: string,
  signature: string,
  rawBody: string,
): boolean {
  if (!signature.startsWith('sha1=')) return false
  const received = signature.slice('sha1='.length)
  const expected = createHmac('sha1', clientSecret).update(rawBody).digest('hex')

  try {
    return timingSafeEqual(Buffer.from(received), Buffer.from(expected))
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text()

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const topic = payload.topic as string | undefined
  const appId = payload.app_id as string | undefined

  if (!appId) {
    return NextResponse.json({ error: 'Missing app_id' }, { status: 400 })
  }

  // Find the Intercom integration by app_id stored in config.
  const { data: integration, error: integrationError } = await adminClient
    .from('integrations')
    .select('id, team_id, config')
    .eq('platform', 'intercom')
    .eq('is_active', true)
    .filter('config->>app_id', 'eq', appId)
    .maybeSingle()

  if (integrationError) {
    console.error('[webhooks/intercom] integration lookup error:', integrationError.message)
    return NextResponse.json({ ok: true })
  }

  if (!integration) {
    return NextResponse.json({ ok: true })
  }

  const config = integration.config as Record<string, string>
  const clientSecret = config.client_secret

  if (!clientSecret) {
    console.error('[webhooks/intercom] integration missing client_secret', integration.id)
    return NextResponse.json({ ok: true })
  }

  // Verify the signature.
  const hubSignature = request.headers.get('X-Hub-Signature') ?? ''
  if (!verifyIntercomSignature(clientSecret, hubSignature, rawBody)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Only process conversation reply topics.
  const supportedTopics = [
    'conversation.user.replied',
    'conversation.admin.replied',
  ]

  if (!topic || !supportedTopics.includes(topic)) {
    return NextResponse.json({ ok: true })
  }

  const data = payload.data as Record<string, unknown> | undefined
  const item = data?.item as Record<string, unknown> | undefined

  if (!item) {
    return NextResponse.json({ ok: true })
  }

  const conversationId = (item.conversation_id as string | undefined) ?? (item.id as string | undefined) ?? ''
  const body = (item.body as string | undefined) ?? ''
  const author = item.author as Record<string, unknown> | undefined
  const authorName = (author?.name as string | undefined) ?? null
  const authorType = (author?.type as string | undefined) ?? 'unknown'

  if (!conversationId || !body.trim()) {
    return NextResponse.json({ ok: true })
  }

  // Strip HTML tags from Intercom's body (it sends HTML).
  const plainText = body.replace(/<[^>]*>/g, '').trim()

  if (!plainText) {
    return NextResponse.json({ ok: true })
  }

  const externalId = `${conversationId}_${(payload.created_at as number | undefined) ?? Date.now()}`

  const { error: insertError } = await adminClient
    .from('incoming_messages')
    .insert({
      team_id: integration.team_id,
      integration_id: integration.id,
      platform: 'intercom',
      external_id: externalId,
      channel_id: conversationId,
      sender_name: authorName ?? authorType,
      content: plainText,
      raw_payload: payload,
      classification_status: 'pending',
      received_at: new Date().toISOString(),
    })

  if (insertError) {
    console.error('[webhooks/intercom] insert error:', insertError.message)
  }

  return NextResponse.json({ ok: true })
}
