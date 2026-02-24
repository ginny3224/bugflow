'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface InviteDetails {
  id: string
  email: string
  role: string
  team: {
    id: string
    name: string
  }
}

export default function InvitePage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const [invite, setInvite] = useState<InviteDetails | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'accepting' | 'error' | 'success'>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    async function loadInvite() {
      const supabase = createClient()

      const { data, error } = await supabase
        .from('team_invites')
        .select('id, email, role, teams(id, name)')
        .eq('token', params.token)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .single()

      if (error || !data) {
        setErrorMessage('This invite link is invalid or has expired.')
        setStatus('error')
        return
      }

      const teamsRaw = data.teams as unknown
      const teamsData = Array.isArray(teamsRaw) ? teamsRaw[0] as { id: string; name: string } | undefined : teamsRaw as { id: string; name: string } | null

      setInvite({
        id: data.id,
        email: data.email,
        role: data.role,
        team: {
          id: teamsData?.id ?? '',
          name: teamsData?.name ?? 'Unknown Team',
        },
      })
      setStatus('ready')
    }

    loadInvite()
  }, [params.token])

  async function handleAccept() {
    if (!invite) return
    setStatus('accepting')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      // Not logged in — send to login, then back here after auth.
      router.push(`/login?redirect=/invite/${params.token}`)
      return
    }

    const res = await fetch(`/api/team/invite/${params.token}/accept`, {
      method: 'POST',
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setErrorMessage(body.error ?? 'Failed to accept invite. Please try again.')
      setStatus('error')
      return
    }

    setStatus('success')
    setTimeout(() => router.replace('/'), 1500)
  }

  const roleLabel = invite?.role
    ? invite.role.charAt(0).toUpperCase() + invite.role.slice(1)
    : ''

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2"
          style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: '#0a84ff' }}
        />
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Loading invite…
        </p>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="w-full max-w-md px-4">
        <div
          className="rounded-2xl border p-8 text-center"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            backdropFilter: 'blur(20px)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
          }}
        >
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: 'rgba(48, 209, 88, 0.15)' }}
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="#30d158"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-lg font-medium text-white">You're in!</h2>
          <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Redirecting to your dashboard…
          </p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="w-full max-w-md px-4">
        <div
          className="rounded-2xl border p-8 text-center"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            backdropFilter: 'blur(20px)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
          }}
        >
          <h2 className="mb-2 text-lg font-medium text-white">
            Invalid invite
          </h2>
          <p className="mb-6 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {errorMessage}
          </p>
          <button
            onClick={() => router.replace('/login')}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white"
            style={{ background: '#0a84ff' }}
          >
            Go to login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md px-4">
      <div
        className="rounded-2xl border p-8"
        style={{
          background: 'rgba(255, 255, 255, 0.04)',
          backdropFilter: 'blur(20px)',
          borderColor: 'rgba(255, 255, 255, 0.08)',
        }}
      >
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: 'rgba(10, 132, 255, 0.15)' }}
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="#0a84ff"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white">
            You've been invited
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Join{' '}
            <span className="font-medium text-white">{invite?.team.name}</span>{' '}
            on BugFlow
          </p>
        </div>

        <div
          className="mb-6 rounded-xl p-4"
          style={{ background: 'rgba(255, 255, 255, 0.04)' }}
        >
          <div className="flex items-center justify-between text-sm">
            <span style={{ color: 'rgba(255,255,255,0.45)' }}>Invited as</span>
            <span className="font-medium text-white">{invite?.email}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span style={{ color: 'rgba(255,255,255,0.45)' }}>Role</span>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                background: 'rgba(10, 132, 255, 0.15)',
                color: '#0a84ff',
              }}
            >
              {roleLabel}
            </span>
          </div>
        </div>

        <button
          onClick={handleAccept}
          disabled={status === 'accepting'}
          className="w-full rounded-lg py-2.5 text-sm font-medium text-white transition-all disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: '#0a84ff' }}
        >
          {status === 'accepting' ? 'Accepting…' : 'Accept Invite'}
        </button>
      </div>
    </div>
  )
}
