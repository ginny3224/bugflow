/**
 * GET /api/cron/weekly-digest
 *
 * Vercel cron handler — enqueues a `generate_digest` job for every team
 * whose digest_day_of_week + digest_hour_utc matches the current UTC moment.
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

  const now = new Date()
  const currentDayOfWeek = now.getUTCDay()    // 0 (Sunday) – 6 (Saturday)
  const currentHourUtc = now.getUTCHours()    // 0 – 23

  // Fetch all team_settings where today matches the configured digest day and hour.
  const { data: settings, error: settingsError } = await adminClient
    .from('team_settings')
    .select('team_id, digest_day_of_week, digest_hour_utc')
    .eq('digest_day_of_week', currentDayOfWeek)
    .eq('digest_hour_utc', currentHourUtc)

  if (settingsError) {
    console.error('[cron/weekly-digest] settings fetch error:', settingsError.message)
    return NextResponse.json({ error: 'Failed to fetch team settings' }, { status: 500 })
  }

  if (!settings || settings.length === 0) {
    return NextResponse.json({ enqueued: 0 })
  }

  const jobs = settings.map((s) => ({
    team_id: s.team_id,
    job_type: 'generate_digest',
    status: 'pending',
    payload: {
      triggered_at: now.toISOString(),
    },
    max_attempts: 3,
  }))

  const { error: insertError } = await adminClient
    .from('job_queue')
    .insert(jobs)

  if (insertError) {
    console.error('[cron/weekly-digest] job insert error:', insertError.message)
    return NextResponse.json({ error: 'Failed to enqueue jobs' }, { status: 500 })
  }

  return NextResponse.json({ enqueued: jobs.length })
}
