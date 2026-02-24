/**
 * POST /api/bugs/[id]/approve
 *
 * Marks a bug report as approved and enqueues a `create_monday_item` job so
 * the worker can push it to the team's Monday.com board.
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

  // Update the bug report.
  const { data: bug, error: updateError } = await adminClient
    .from('bug_reports')
    .update({
      status: 'approved',
      reviewed_by_user_id: user.id,
      reviewed_at: now,
      updated_at: now,
    })
    .eq('id', id)
    .eq('team_id', teamId)
    .select('*')
    .single()

  if (updateError) {
    if (updateError.code === 'PGRST116') {
      return NextResponse.json({ error: 'Bug report not found' }, { status: 404 })
    }
    console.error('[api/bugs/[id]/approve] update error:', updateError.message)
    return NextResponse.json({ error: 'Failed to approve bug report' }, { status: 500 })
  }

  // Enqueue the create_monday_item job.
  const { error: jobError } = await adminClient
    .from('job_queue')
    .insert({
      team_id: teamId,
      job_type: 'create_monday_item',
      status: 'pending',
      payload: { bug_report_id: id },
      max_attempts: 3,
    })

  if (jobError) {
    // Log but do not fail the request — the bug is already approved.
    console.error('[api/bugs/[id]/approve] enqueue job error:', jobError.message)
  }

  return NextResponse.json({ bug })
}
