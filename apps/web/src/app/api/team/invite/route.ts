import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { randomBytes } from 'crypto'

const InviteMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
})

export async function POST(request: NextRequest) {
  // Authenticate the calling user.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Look up the user's team membership and confirm they can invite (owner or admin).
  const { data: membership } = await supabase
    .from('team_members')
    .select('team_id, role')
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json(
      { error: 'You must belong to a team to invite members' },
      { status: 403 }
    )
  }

  if (!['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json(
      { error: 'Only owners and admins can invite members' },
      { status: 403 }
    )
  }

  // Parse + validate request body.
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = InviteMemberSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    )
  }

  const { email, role } = parsed.data

  // Check the invitee isn't already a member.
  const { data: existingMember } = await adminClient
    .from('team_members')
    .select('id')
    .eq('team_id', membership.team_id)
    .eq('email', email)
    .maybeSingle()

  if (existingMember) {
    return NextResponse.json(
      { error: 'This person is already a team member' },
      { status: 409 }
    )
  }

  // Generate a secure random token.
  const token = randomBytes(32).toString('hex')

  // Set invite expiry to 7 days from now.
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  // Create the invite record.
  const { data: invite, error: inviteError } = await adminClient
    .from('team_invites')
    .insert({
      team_id: membership.team_id,
      email,
      role,
      token,
      invited_by: user.id,
      expires_at: expiresAt.toISOString(),
    })
    .select('id, email, role, token, expires_at')
    .single()

  if (inviteError || !invite) {
    console.error('[api/team/invite] create invite error:', inviteError?.message)
    return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 })
  }

  // NOTE: Email delivery is out of scope. The invite token is returned so the
  // caller can construct the invite URL: /invite/[token]
  return NextResponse.json({ invite }, { status: 201 })
}
