/**
 * /api/integrations/[id]
 *
 * PATCH  – Update an integration (toggle active, update config).
 *           Sensitive config values are encrypted before storage.
 * DELETE – Soft-delete / disable an integration.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { encrypt } from '@/lib/encryption'
import { z } from 'zod'

type RouteContext = { params: Promise<{ id: string }> }

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

const PatchIntegrationSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  is_active: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
})

// ---------------------------------------------------------------------------
// PATCH /api/integrations/[id]
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

  const parsed = PatchIntegrationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    )
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (parsed.data.name !== undefined) {
    updatePayload.name = parsed.data.name
  }
  if (parsed.data.is_active !== undefined) {
    updatePayload.is_active = parsed.data.is_active
  }

  if (parsed.data.config !== undefined) {
    // Fetch existing config and merge — only encrypt fields provided in this request.
    const { data: existing } = await adminClient
      .from('integrations')
      .select('config')
      .eq('id', id)
      .eq('team_id', teamId)
      .single()

    const existingConfig = (existing?.config as Record<string, unknown>) ?? {}

    let incomingEncrypted: Record<string, unknown>
    try {
      incomingEncrypted = encryptSensitiveConfig(
        parsed.data.config as Record<string, unknown>,
      )
    } catch (err) {
      console.error('[api/integrations/[id]] encryption error:', err)
      return NextResponse.json(
        { error: 'Failed to encrypt credentials' },
        { status: 500 },
      )
    }

    updatePayload.config = { ...existingConfig, ...incomingEncrypted }
  }

  const { data: integration, error } = await adminClient
    .from('integrations')
    .update(updatePayload)
    .eq('id', id)
    .eq('team_id', teamId)
    .select('id, platform, name, is_active, created_at, updated_at')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }
    console.error('[api/integrations/[id]] PATCH error:', error.message)
    return NextResponse.json({ error: 'Failed to update integration' }, { status: 500 })
  }

  return NextResponse.json({ integration })
}

// ---------------------------------------------------------------------------
// DELETE /api/integrations/[id]
// ---------------------------------------------------------------------------

export async function DELETE(
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

  // Soft-delete: set is_active to false rather than hard-deleting the row.
  const { data: integration, error } = await adminClient
    .from('integrations')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('team_id', teamId)
    .select('id, platform, name, is_active, updated_at')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }
    console.error('[api/integrations/[id]] DELETE error:', error.message)
    return NextResponse.json({ error: 'Failed to disable integration' }, { status: 500 })
  }

  return NextResponse.json({ integration })
}
