/**
 * POST /api/bugs/[id]/reject
 *
 * Marks a bug report as rejected, recording the reviewer and timestamp.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'

type RouteContext = { params: Promise<{ id: string }> }

async function getTeamId(userId: string): Promise<string | null> {
  const { data } = await adminClient
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .single()
  return data?.team_id ?? null
}

export async function POST(
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
  const now = new Date().toISOString()

  const { data: bug, error } = await adminClient
    .from('bug_reports')
    .update({
      status: 'rejected',
      reviewed_by_user_id: user.id,
      reviewed_at: now,
      updated_at: now,
    })
    .eq('id', id)
    .eq('team_id', teamId)
    .select('*')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Bug report not found' }, { status: 404 })
    }
    console.error('[api/bugs/[id]/reject] update error:', error.message)
    return NextResponse.json({ error: 'Failed to reject bug report' }, { status: 500 })
  }

  return NextResponse.json({ bug })
}
