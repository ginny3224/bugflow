/**
 * /api/bugs
 *
 * GET  – Fetch bug reports for the authenticated user's team.
 *         Supports pagination, status/severity filters, search query, and sorting.
 * POST – Manually create a bug report (admin use).
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
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

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const GetQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z
    .enum(['pending_review', 'approved', 'rejected', 'merged', 'created_in_monday'])
    .optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  q: z.string().max(200).optional(),
  sort: z
    .enum(['created_at', 'updated_at', 'severity', 'status'])
    .default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
})

const CreateBugSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().min(1),
  steps_to_reproduce: z.string().optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  category: z
    .enum([
      'ui_ux',
      'performance',
      'data_loss',
      'security',
      'crash',
      'api',
      'authentication',
      'integration',
      'other',
    ])
    .default('other'),
  incoming_message_id: z.string().uuid().optional(),
})

// ---------------------------------------------------------------------------
// GET /api/bugs
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
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

  const { searchParams } = new URL(request.url)
  const parsed = GetQuerySchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid query parameters' },
      { status: 400 },
    )
  }

  const { page, limit, status, severity, q, sort, order } = parsed.data
  const offset = (page - 1) * limit

  let query = adminClient
    .from('bug_reports')
    .select('*', { count: 'exact' })
    .eq('team_id', teamId)

  if (status) query = query.eq('status', status)
  if (severity) query = query.eq('severity', severity)
  if (q) {
    query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`)
  }

  query = query
    .order(sort, { ascending: order === 'asc' })
    .range(offset, offset + limit - 1)

  const { data: bugs, error, count } = await query

  if (error) {
    console.error('[api/bugs] GET error:', error.message)
    return NextResponse.json({ error: 'Failed to fetch bugs' }, { status: 500 })
  }

  return NextResponse.json({
    bugs,
    pagination: {
      page,
      limit,
      total: count ?? 0,
      pages: Math.ceil((count ?? 0) / limit),
    },
  })
}

// ---------------------------------------------------------------------------
// POST /api/bugs
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

  const parsed = CreateBugSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    )
  }

  const {
    title,
    description,
    steps_to_reproduce,
    severity,
    category,
    incoming_message_id,
  } = parsed.data

  const { data: bug, error } = await adminClient
    .from('bug_reports')
    .insert({
      team_id: teamId,
      title,
      description,
      steps_to_reproduce: steps_to_reproduce ?? null,
      severity,
      category,
      status: 'pending_review',
      incoming_message_id: incoming_message_id ?? null,
      reviewed_by_user_id: null,
      reviewed_at: null,
    })
    .select('*')
    .single()

  if (error || !bug) {
    console.error('[api/bugs] POST error:', error?.message)
    return NextResponse.json({ error: 'Failed to create bug report' }, { status: 500 })
  }

  return NextResponse.json({ bug }, { status: 201 })
}
