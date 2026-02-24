/**
 * POST /api/bugs/[id]/merge
 *
 * Marks a bug report as a duplicate of another, merges its source message
 * references into the target, and enqueues a `generate_summary` job so the
 * target's description stays up to date.
 *
 * Body: { merge_into_id: string }
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

const MergeBodySchema = z.object({
  merge_into_id: z.string().uuid('merge_into_id must be a valid UUID'),
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

  const parsed = MergeBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    )
  }

  const { merge_into_id } = parsed.data

  if (id === merge_into_id) {
    return NextResponse.json(
      { error: 'A bug report cannot be merged into itself' },
      { status: 400 },
    )
  }

  // Verify the target bug exists and belongs to the same team.
  const { data: targetBug, error: targetError } = await adminClient
    .from('bug_reports')
    .select('id, source_message_ids')
    .eq('id', merge_into_id)
    .eq('team_id', teamId)
    .single()

  if (targetError || !targetBug) {
    return NextResponse.json(
      { error: 'Target bug report not found' },
      { status: 404 },
    )
  }

  // Fetch the source bug to get its message IDs.
  const { data: sourceBug, error: sourceFetchError } = await adminClient
    .from('bug_reports')
    .select('id, source_message_ids')
    .eq('id', id)
    .eq('team_id', teamId)
    .single()

  if (sourceFetchError || !sourceBug) {
    return NextResponse.json({ error: 'Bug report not found' }, { status: 404 })
  }

  const now = new Date().toISOString()

  // Mark the source as merged.
  const { data: mergedBug, error: mergeError } = await adminClient
    .from('bug_reports')
    .update({
      status: 'merged',
      merged_into_id: merge_into_id,
      updated_at: now,
    })
    .eq('id', id)
    .eq('team_id', teamId)
    .select('*')
    .single()

  if (mergeError || !mergedBug) {
    console.error('[api/bugs/[id]/merge] merge update error:', mergeError?.message)
    return NextResponse.json({ error: 'Failed to merge bug report' }, { status: 500 })
  }

  // Merge source_message_ids into the target.
  const sourceIds: string[] = Array.isArray(sourceBug.source_message_ids)
    ? (sourceBug.source_message_ids as string[])
    : []
  const targetIds: string[] = Array.isArray(targetBug.source_message_ids)
    ? (targetBug.source_message_ids as string[])
    : []
  const mergedIds = Array.from(new Set([...targetIds, ...sourceIds]))

  const { error: targetUpdateError } = await adminClient
    .from('bug_reports')
    .update({
      source_message_ids: mergedIds,
      updated_at: now,
    })
    .eq('id', merge_into_id)
    .eq('team_id', teamId)

  if (targetUpdateError) {
    console.error(
      '[api/bugs/[id]/merge] target update error:',
      targetUpdateError.message,
    )
  }

  // Enqueue generate_summary for the target bug.
  const { error: jobError } = await adminClient
    .from('job_queue')
    .insert({
      team_id: teamId,
      job_type: 'generate_summary',
      status: 'pending',
      payload: { bug_report_id: merge_into_id },
      max_attempts: 3,
    })

  if (jobError) {
    console.error('[api/bugs/[id]/merge] enqueue job error:', jobError.message)
  }

  return NextResponse.json({ bug: mergedBug })
}
