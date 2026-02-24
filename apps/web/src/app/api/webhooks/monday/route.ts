/**
 * POST /api/webhooks/monday
 *
 * Handles Monday.com webhook notifications.
 *
 * Monday.com sends a challenge object on webhook setup — respond with it to
 * confirm the endpoint. For item change events we upsert monday_backlog_items.
 *
 * Monday.com does not sign webhook requests at the HTTP level; instead the
 * challenge handshake acts as the ownership proof. The webhook URL should be
 * treated as a secret and kept out of public repositories.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  let payload: Record<string, unknown>
  try {
    payload = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Monday.com challenge verification — must echo the challenge back.
  if ('challenge' in payload && payload.challenge) {
    return NextResponse.json({ challenge: payload.challenge })
  }

  const event = payload.event as Record<string, unknown> | undefined
  if (!event) {
    return NextResponse.json({ ok: true })
  }

  const boardId = event.boardId as number | undefined
  const itemId = event.itemId as number | undefined
  const pulseName = (event.pulseName as string | undefined) ?? null
  const columnValues = (event.value as Record<string, unknown> | undefined) ?? {}

  if (!boardId || !itemId) {
    return NextResponse.json({ ok: true })
  }

  // Find the integration that owns this board.
  const boardIdStr = String(boardId)
  const { data: integrations, error: integrationError } = await adminClient
    .from('integrations')
    .select('id, team_id, config')
    .eq('platform', 'monday')
    .eq('is_active', true)
    .filter('config->>board_id', 'eq', boardIdStr)

  if (integrationError) {
    console.error('[webhooks/monday] integration lookup error:', integrationError.message)
    return NextResponse.json({ ok: true })
  }

  const integration = integrations?.[0]
  if (!integration) {
    // No team owns this board; accept silently.
    return NextResponse.json({ ok: true })
  }

  const mondayItemId = String(itemId)
  const now = new Date().toISOString()

  // Upsert the backlog item record.
  const { error: upsertError } = await adminClient
    .from('monday_backlog_items')
    .upsert(
      {
        team_id: integration.team_id,
        monday_board_id: boardIdStr,
        monday_item_id: mondayItemId,
        monday_item_name: pulseName ?? mondayItemId,
        monday_column_values: columnValues,
        monday_item_url: `https://monday.com/boards/${boardId}/pulses/${itemId}`,
        synced_at: now,
      },
      {
        onConflict: 'monday_item_id',
        ignoreDuplicates: false,
      },
    )

  if (upsertError) {
    console.error('[webhooks/monday] upsert error:', upsertError.message)
  }

  return NextResponse.json({ ok: true })
}
