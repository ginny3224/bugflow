import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

const CreateTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100),
})

export async function POST(request: NextRequest) {
  // Authenticate the calling user via the session cookie.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse + validate request body.
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateTeamSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    )
  }

  const { name } = parsed.data

  // Create the team record.
  const { data: team, error: teamError } = await adminClient
    .from('teams')
    .insert({ name })
    .select('id, name')
    .single()

  if (teamError || !team) {
    console.error('[api/team] create team error:', teamError?.message)
    return NextResponse.json({ error: 'Failed to create team' }, { status: 500 })
  }

  // Add the user as owner in team_members.
  const { error: memberError } = await adminClient
    .from('team_members')
    .insert({ team_id: team.id, user_id: user.id, role: 'owner' })

  if (memberError) {
    console.error('[api/team] add member error:', memberError.message)
    // Roll back the team to avoid orphaned records.
    await adminClient.from('teams').delete().eq('id', team.id)
    return NextResponse.json(
      { error: 'Failed to add team member' },
      { status: 500 }
    )
  }

  // Create default team settings.
  const { error: settingsError } = await adminClient
    .from('team_settings')
    .insert({ team_id: team.id })

  if (settingsError) {
    // Non-fatal — log but don't fail the request.
    console.warn('[api/team] create team_settings error:', settingsError.message)
  }

  return NextResponse.json({ team }, { status: 201 })
}
