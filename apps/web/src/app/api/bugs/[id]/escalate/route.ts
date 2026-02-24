/**
 * POST /api/bugs/[id]/escalate
 *
 * Updates the severity of a bug report.
 *
 * Body: { severity: 'critical' | 'high' | 'medium' | 'low' }
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

type RouteContext = { params: Promise<{ id: string }> }

async function getTeamId(userId: string): Promise<string | null> {
  const { data } = await adminClient
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .single()
  return data?.team_id ?? null
}

const EscalateBodySchema = z.object({
  severity: z.enum(['critical', 'high', 'medium', 'low']),
})

export async function POST(
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

  const parsed = EscalateBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    )
  }

  const { severity } = parsed.data
  const now = new Date().toISOString()

  const { data: bug, error } = await adminClient
    .from('bug_reports')
    .update({ severity, updated_at: now })
    .eq('id', id)
    .eq('team_id', teamId)
    .select('*')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Bug report not found' }, { status: 404 })
    }
    console.error('[api/bugs/[id]/escalate] update error:', error.message)
    return NextResponse.json({ error: 'Failed to update severity' }, { status: 500 })
  }

  return NextResponse.json({ bug })
}
