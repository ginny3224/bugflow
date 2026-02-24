'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function VerifyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'create-team' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [teamName, setTeamName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    async function handleVerify() {
      const code = searchParams.get('code')

      if (!code) {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setErrorMessage('No verification code found. Please request a new magic link.')
          setStatus('error')
          return
        }
        await checkTeamAndRedirect(supabase, user.id)
        return
      }

      const supabase = createClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        setErrorMessage(error.message)
        setStatus('error')
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setErrorMessage('Authentication failed. Please try again.')
        setStatus('error')
        return
      }

      await checkTeamAndRedirect(supabase, user.id)
    }

    async function checkTeamAndRedirect(
      supabase: ReturnType<typeof createClient>,
      userId: string
    ) {
      const { data: membership } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', userId)
        .limit(1)
        .single()

      if (membership) {
        router.replace('/')
      } else {
        setStatus('create-team')
      }
    }

    handleVerify()
  }, [searchParams, router])

  async function handleCreateTeam(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)

    const res = await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: teamName }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setCreateError(body.error ?? 'Failed to create team. Please try again.')
      setCreating(false)
      return
    }

    router.replace('/')
  }

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: '#0a84ff' }}
        />
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Verifying your session…
        </p>
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
            Verification failed
          </h2>
          <p className="mb-6 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {errorMessage}
          </p>
          <button
            onClick={() => router.replace('/login')}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white"
            style={{ background: '#0a84ff' }}
          >
            Back to login
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
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-white">Create your team</h1>
          <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Give your workspace a name to get started.
          </p>
        </div>

        <form onSubmit={handleCreateTeam} className="space-y-4">
          <div>
            <label
              htmlFor="team-name"
              className="mb-1.5 block text-sm font-medium"
              style={{ color: 'rgba(255,255,255,0.7)' }}
            >
              Team name
            </label>
            <input
              id="team-name"
              type="text"
              required
              autoFocus
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Acme Corp"
              className="w-full rounded-lg px-3.5 py-2.5 text-sm text-white outline-none transition-all placeholder:text-white/25"
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#0a84ff'
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(10, 132, 255, 0.15)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
          </div>

          {createError && (
            <p
              className="rounded-lg px-3 py-2 text-sm"
              style={{
                color: '#ff453a',
                background: 'rgba(255, 69, 58, 0.1)',
                border: '1px solid rgba(255, 69, 58, 0.2)',
              }}
            >
              {createError}
            </p>
          )}

          <button
            type="submit"
            disabled={creating || !teamName.trim()}
            className="w-full rounded-lg py-2.5 text-sm font-medium text-white transition-all disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: '#0a84ff' }}
          >
            {creating ? 'Creating…' : 'Create Team'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center gap-4">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: '#0a84ff' }}
          />
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Loading…
          </p>
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  )
}
