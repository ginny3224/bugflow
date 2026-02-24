'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })

    if (authError) {
      setError(authError.message)
    } else {
      setSent(true)
    }

    setLoading(false)
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
        {/* Logo / wordmark */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            BugFlow
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            AI-powered bug tracking aggregation
          </p>
        </div>

        {sent ? (
          <div className="text-center">
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
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-medium text-white">Check your email</h2>
            <p
              className="mt-2 text-sm"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              We sent a magic link to{' '}
              <span className="font-medium text-white">{email}</span>. Click it
              to sign in.
            </p>
            <button
              onClick={() => {
                setSent(false)
                setEmail('')
              }}
              className="mt-6 text-sm"
              style={{ color: '#0a84ff' }}
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium"
                style={{ color: 'rgba(255,255,255,0.7)' }}
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-lg px-3.5 py-2.5 text-sm text-white outline-none transition-all placeholder:text-white/25"
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#0a84ff'
                  e.currentTarget.style.boxShadow =
                    '0 0 0 3px rgba(10, 132, 255, 0.15)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>

            {error && (
              <p
                className="rounded-lg px-3 py-2 text-sm"
                style={{
                  color: '#ff453a',
                  background: 'rgba(255, 69, 58, 0.1)',
                  border: '1px solid rgba(255, 69, 58, 0.2)',
                }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full rounded-lg py-2.5 text-sm font-medium text-white transition-all disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: '#0a84ff' }}
              onMouseEnter={(e) => {
                if (!loading && email)
                  e.currentTarget.style.background = '#0070d8'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#0a84ff'
              }}
            >
              {loading ? 'Sending…' : 'Send Magic Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
