/**
 * POST /api/webhooks/discord
 *
 * Handles Discord Interactions webhook (slash commands and components).
 * Ed25519 signature verification is mandatory — Discord will reject the
 * endpoint if it does not respond correctly to the PING interaction.
 *
 * Note: Live Discord message ingestion (guild messages, DMs) happens via the
 * discord.js gateway in the BugFlow worker process, not through this endpoint.
 * This route exists solely for Discord's interactions / slash-command flow.
 *
 * Discord interaction types:
 *  1 = PING
 *  2 = APPLICATION_COMMAND
 *  3 = MESSAGE_COMPONENT
 *  4 = APPLICATION_COMMAND_AUTOCOMPLETE
 *  5 = MODAL_SUBMIT
 */

import { NextResponse, type NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Ed25519 signature verification using the Web Crypto API
// (available in both Node.js 20+ and the Edge runtime)
// ---------------------------------------------------------------------------

async function verifyEd25519Signature(
  publicKey: string,
  signature: string,
  timestamp: string,
  rawBody: string,
): Promise<boolean> {
  try {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      hexToBuffer(publicKey),
      { name: 'Ed25519' },
      false,
      ['verify'],
    )

    const encoder = new TextEncoder()
    const data = encoder.encode(timestamp + rawBody)

    return await crypto.subtle.verify(
      'Ed25519',
      cryptoKey,
      hexToBuffer(signature),
      data,
    )
  } catch {
    return false
  }
}

function hexToBuffer(hex: string): ArrayBuffer {
  const pairs = hex.match(/.{1,2}/g) ?? []
  const arr = new Uint8Array(pairs.map((byte) => parseInt(byte, 16)))
  return arr.buffer as ArrayBuffer
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text()

  const signature = request.headers.get('X-Signature-Ed25519') ?? ''
  const timestamp = request.headers.get('X-Signature-Timestamp') ?? ''

  const publicKey = process.env.DISCORD_PUBLIC_KEY
  if (!publicKey) {
    console.error('[webhooks/discord] DISCORD_PUBLIC_KEY is not configured')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const isValid = await verifyEd25519Signature(publicKey, signature, timestamp, rawBody)
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid request signature' }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const interactionType = payload.type as number | undefined

  // Type 1 = PING — must respond with type 1 or Discord deactivates the endpoint.
  if (interactionType === 1) {
    return NextResponse.json({ type: 1 })
  }

  // All other interaction types are acknowledged with a 200.
  // Slash command handling can be expanded here when needed.
  return NextResponse.json({ ok: true })
}
