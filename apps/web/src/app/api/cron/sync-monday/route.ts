/**
 * GET /api/cron/sync-monday
 *
 * Vercel cron handler — syncs Monday.com board items for every team that
 * has an active Monday.com integration.
 *
 * Authorization: Bearer <CRON_SECRET>
 *
 * For each integration:
 *  1. Fetch all items from the configured board (cursor-paginated).
 *  2. Upsert each item into monday_backlog_items.
 *
 * Returns: { synced: number } — total items upserted across all integrations.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/encryption'

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  // Constant-time comparison to prevent timing attacks.
  if (token.length !== secret.length) return false
  let mismatch = 0
  for (let i = 0; i < token.length; i++) {
    mismatch |= token.charCodeAt(i) ^ secret.charCodeAt(i)
  }
  return mismatch === 0
}

// ---------------------------------------------------------------------------
// Monday.com helpers
// ---------------------------------------------------------------------------

interface MondayItem {
  id: string
  name: string
  column_values: Array<{ id: string; text: string; value: string }>
}

interface MondayPageResult {
  items: MondayItem[]
  nextCursor: string | null
}

async function fetchMondayPage(
  apiKey: string,
  boardId: string,
  cursor?: string,
): Promise<MondayPageResult> {
  const query = `
    query GetItems($boardId: ID!, $cursor: String) {
      boards(ids: [$boardId]) {
        items_page(limit: 50, cursor: $cursor) {
          cursor
          items {
            id
            name
            column_values { id text value }
          }
        }
      }
    }
  `

  const response = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
      'API-Version': '2024-01',
    },
    body: JSON.stringify({ query, variables: { boardId, cursor: cursor ?? null } }),
  })

  if (!response.ok) {
    throw new Error(`Monday.com API HTTP ${response.status}`)
  }

  const json = (await response.json()) as {
    data?: {
      boards?: Array<{
        items_page?: { cursor: string | null; items: MondayItem[] }
      }>
    }
    errors?: Array<{ message: string }>
  }

  if (json.errors?.length) {
    throw new Error(`Monday.com GraphQL: ${json.errors.map((e) => e.message).join('; ')}`)
  }

  const page = json.data?.boards?.[0]?.items_page
  if (!page) {
    throw new Error('Monday.com returned no items_page')
  }

  return { items: page.items, nextCursor: page.cursor }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch all active Monday.com integrations.
  const { data: integrations, error: integrationError } = await adminClient
    .from('integrations')
    .select('id, team_id, config')
    .eq('platform', 'monday')
    .eq('is_active', true)

  if (integrationError) {
    console.error('[cron/sync-monday] integration fetch error:', integrationError.message)
    return NextResponse.json({ error: 'Failed to fetch integrations' }, { status: 500 })
  }

  let totalSynced = 0

  for (const integration of integrations ?? []) {
    const config = integration.config as Record<string, string>

    let apiKey: string
    try {
      apiKey = config.api_key ? decrypt(config.api_key) : ''
    } catch {
      console.error('[cron/sync-monday] decrypt error for integration', integration.id)
      continue
    }

    const boardId = config.board_id
    if (!apiKey || !boardId) {
      console.warn('[cron/sync-monday] skipping integration with missing config', integration.id)
      continue
    }

    try {
      let cursor: string | undefined
      const allItems: MondayItem[] = []

      // Paginate through all board items.
      do {
        const page = await fetchMondayPage(apiKey, boardId, cursor)
        allItems.push(...page.items)
        cursor = page.nextCursor ?? undefined
      } while (cursor)

      if (allItems.length === 0) continue

      const now = new Date().toISOString()

      const rows = allItems.map((item) => ({
        team_id: integration.team_id,
        monday_board_id: boardId,
        monday_item_id: item.id,
        monday_item_name: item.name,
        monday_column_values: Object.fromEntries(
          item.column_values.map((cv) => [cv.id, { text: cv.text, value: cv.value }]),
        ),
        monday_item_url: `https://monday.com/boards/${boardId}/pulses/${item.id}`,
        synced_at: now,
      }))

      const { error: upsertError } = await adminClient
        .from('monday_backlog_items')
        .upsert(rows, { onConflict: 'monday_item_id', ignoreDuplicates: false })

      if (upsertError) {
        console.error(
          '[cron/sync-monday] upsert error for integration',
          integration.id,
          ':',
          upsertError.message,
        )
        continue
      }

      totalSynced += allItems.length
    } catch (err) {
      console.error(
        '[cron/sync-monday] fetch error for integration',
        integration.id,
        ':',
        err instanceof Error ? err.message : String(err),
      )
    }
  }

  return NextResponse.json({ synced: totalSynced })
}
