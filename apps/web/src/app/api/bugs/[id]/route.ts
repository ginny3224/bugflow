/**
 * /api/bugs/[id]
 *
 * GET   – Fetch a single bug report including linked incoming messages.
 * PATCH – Update bug fields (status, severity, category, title, description, etc.).
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getTeamId(userId: string): Promise<string | null> {
  const { data } = await adminClient
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .single()
  return data?.team_id ?? null
}

type RouteContext = { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const PatchBugSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().min(1).optional(),
  steps_to_reproduce: z.string().nullable().optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  category: z
    .enum([
      'ui_ux',
      'performance',
      'data_loss',
      'security',
      'crash',
      'api',
      'authentication',
      'integration',
      'other',
    ])
    .optional(),
  status: z
    .enum(['pending_review', 'approved', 'rejected', 'merged', 'created_in_monday'])
    .optional(),
})

// ---------------------------------------------------------------------------
// GET /api/bugs/[id]
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const teamId = await getTeamId(user.id)
  if (!teamId) {
    return NextResponse.json({ error: 'No team found' }, { status: 403 })
  }

  const { id } = await context.params

  const { data: bug, error } = await adminClient
    .from('bug_reports')
    .select(
      `
      *,
      incoming_message:incoming_messages (
        id,
        platform,
        external_id,
        channel_id,
        sender_name,
        content,
        received_at,
        classification_status,
        classification_confidence,
        classification_reasoning
      )
    `,
    )
    .eq('id', id)
    .eq('team_id', teamId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Bug report not found' }, { status: 404 })
    }
    console.error('[api/bugs/[id]] GET error:', error.message)
    return NextResponse.json({ error: 'Failed to fetch bug report' }, { status: 500 })
  }

  return NextResponse.json({ bug })
}

// ---------------------------------------------------------------------------
// PATCH /api/bugs/[id]
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const teamId = await getTeamId(user.id)
  if (!teamId) {
    return NextResponse.json({ error: 'No team found' }, { status: 403 })
  }

  const { id } = await context.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = PatchBugSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    )
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data: bug, error } = await adminClient
    .from('bug_reports')
    .update({
      ...parsed.data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('team_id', teamId)
    .select('*')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Bug report not found' }, { status: 404 })
    }
    console.error('[api/bugs/[id]] PATCH error:', error.message)
    return NextResponse.json({ error: 'Failed to update bug report' }, { status: 500 })
  }

  return NextResponse.json({ bug })
}
