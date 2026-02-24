/**
 * POST /api/webhooks/telegram
 *
 * Handles Telegram bot webhook updates.
 *
 * Authentication is performed via the `secret_token` query parameter that
 * Telegram passes when the webhook is registered with setWebhook and a
 * secret_token option. Each integration stores its expected token in
 * config.webhook_secret_token.
 *
 * Returns 200 immediately; the worker classifies the message asynchronously.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { adminClient } from '@/lib/supabase/admin'

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

  // The secret_token is passed as a query parameter by Telegram.
  const { searchParams } = new URL(request.url)
  const incomingToken = searchParams.get('secret_token')

  if (!incomingToken) {
    return NextResponse.json({ error: 'Missing secret_token' }, { status: 401 })
  }

  // Extract the chat ID from the update to find the matching integration.
  const message = payload.message as Record<string, unknown> | undefined
  const editedMessage = payload.edited_message as Record<string, unknown> | undefined
  const update = message ?? editedMessage

  if (!update) {
    // Ignore non-message updates (inline queries, etc.).
    return NextResponse.json({ ok: true })
  }

  const chat = update.chat as Record<string, unknown> | undefined
  const chatId = chat?.id as number | undefined

  if (!chatId) {
    return NextResponse.json({ ok: true })
  }

  // Find all active Telegram integrations and locate the one whose
  // webhook_secret_token matches the incoming token.
  const { data: integrations, error: integrationError } = await adminClient
    .from('integrations')
    .select('id, team_id, config')
    .eq('platform', 'telegram')
    .eq('is_active', true)

  if (integrationError) {
    console.error('[webhooks/telegram] integration lookup error:', integrationError.message)
    return NextResponse.json({ ok: true })
  }

  const integration = (integrations ?? []).find((row) => {
    const cfg = row.config as Record<string, string>
    const storedToken = cfg.webhook_secret_token
    if (!storedToken) return false
    try {
      return timingSafeEqual(
        Buffer.from(incomingToken),
        Buffer.from(storedToken),
      )
    } catch {
      return false
    }
  })

  if (!integration) {
    // No matching integration — silently accept to avoid leaking info.
    return NextResponse.json({ ok: true })
  }

  const text = (update.text as string | undefined) ?? ''

  if (!text.trim()) {
    // Skip non-text updates (photos, stickers, etc.).
    return NextResponse.json({ ok: true })
  }

  const from = update.from as Record<string, unknown> | undefined
  const firstName = (from?.first_name as string | undefined) ?? null
  const lastName = (from?.last_name as string | undefined) ?? null
  const senderName = [firstName, lastName].filter(Boolean).join(' ') || null
  const messageId = (update.message_id as number | undefined) ?? Date.now()
  const date = (update.date as number | undefined) ?? Math.floor(Date.now() / 1000)
  const externalId = `${chatId}_${messageId}_${date}`

  const { error: insertError } = await adminClient
    .from('incoming_messages')
    .insert({
      team_id: integration.team_id,
      integration_id: integration.id,
      platform: 'telegram',
      external_id: externalId,
      channel_id: String(chatId),
      sender_name: senderName,
      content: text,
      raw_payload: payload,
      classification_status: 'pending',
      received_at: new Date().toISOString(),
    })

  if (insertError) {
    console.error('[webhooks/telegram] insert error:', insertError.message)
  }

  return NextResponse.json({ ok: true })
}
