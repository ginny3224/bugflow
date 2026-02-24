/**
 * /api/integrations
 *
 * GET  – List all integrations for the authenticated user's team.
 * POST – Create a new integration.
 *         Sensitive config values named with the prefix `_secret_` are
 *         automatically encrypted before storage.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { encrypt } from '@/lib/encryption'
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

/**
 * Encrypt any config value whose key is a known secret field.
 * The encrypted value is stored with the key stripped of the `_secret_` prefix
 * and replaced with the plain key name, but the value is ciphertext.
 *
 * Secret field convention: keys ending in `_token`, `_secret`, `_key`, `_password`.
 */
const SECRET_FIELD_SUFFIXES = ['_token', '_secret', '_key', '_password']

function encryptSensitiveConfig(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(config)) {
    const isSecret = SECRET_FIELD_SUFFIXES.some((suffix) =>
      key.toLowerCase().endsWith(suffix),
    )

    if (isSecret && typeof value === 'string' && value.length > 0) {
      result[key] = encrypt(value)
    } else {
      result[key] = value
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const CreateIntegrationSchema = z.object({
  platform: z.enum(['slack', 'discord', 'intercom', 'telegram', 'monday', 'x']),
  name: z.string().min(1).max(120),
  config: z.record(z.unknown()).default({}),
})

// ---------------------------------------------------------------------------
// GET /api/integrations
// ---------------------------------------------------------------------------

export async function GET(_request: NextRequest): Promise<NextResponse> {
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

  const { data: integrations, error } = await adminClient
    .from('integrations')
    .select('id, platform, name, is_active, created_at, updated_at')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[api/integrations] GET error:', error.message)
    return NextResponse.json({ error: 'Failed to fetch integrations' }, { status: 500 })
  }

  // Config is intentionally omitted from the list response to avoid leaking
  // encrypted secrets to the frontend. Use GET /api/integrations/[id] to inspect.
  return NextResponse.json({ integrations })
}

// ---------------------------------------------------------------------------
// POST /api/integrations
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateIntegrationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    )
  }

  const { platform, name, config } = parsed.data

  let encryptedConfig: Record<string, unknown>
  try {
    encryptedConfig = encryptSensitiveConfig(config as Record<string, unknown>)
  } catch (err) {
    console.error('[api/integrations] encryption error:', err)
    return NextResponse.json({ error: 'Failed to encrypt credentials' }, { status: 500 })
  }

  const { data: integration, error } = await adminClient
    .from('integrations')
    .insert({
      team_id: teamId,
      platform,
      name,
      config: encryptedConfig,
      is_active: true,
    })
    .select('id, platform, name, is_active, created_at, updated_at')
    .single()

  if (error || !integration) {
    console.error('[api/integrations] POST error:', error?.message)
    return NextResponse.json({ error: 'Failed to create integration' }, { status: 500 })
  }

  return NextResponse.json({ integration }, { status: 201 })
}
