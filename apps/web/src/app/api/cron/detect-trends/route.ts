/**
 * GET /api/cron/detect-trends
 *
 * Vercel cron handler — enqueues a `detect_trends` job for every team.
 *
 * Authorization: Bearer <CRON_SECRET>
 *
 * Returns: { enqueued: number }
 */

import { NextResponse, type NextRequest } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  if (token.length !== secret.length) return false
  let mismatch = 0
  for (let i = 0; i < token.length; i++) {
    mismatch |= token.charCodeAt(i) ^ secret.charCodeAt(i)
  }
  return mismatch === 0
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch all team IDs.
  const { data: teams, error: teamsError } = await adminClient
    .from('teams')
    .select('id')

  if (teamsError) {
    console.error('[cron/detect-trends] teams fetch error:', teamsError.message)
    return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 })
  }

  if (!teams || teams.length === 0) {
    return NextResponse.json({ enqueued: 0 })
  }

  const jobs = teams.map((team) => ({
    team_id: team.id,
    job_type: 'detect_trends',
    status: 'pending',
    payload: {},
    max_attempts: 3,
  }))

  const { error: insertError } = await adminClient
    .from('job_queue')
    .insert(jobs)
    .select('id')

  if (insertError) {
    console.error('[cron/detect-trends] job insert error:', insertError.message)
    return NextResponse.json({ error: 'Failed to enqueue jobs' }, { status: 500 })
  }

  return NextResponse.json({ enqueued: jobs.length })
}
