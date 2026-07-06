'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BrandLockup from '../BrandLockup'

const ERROR_MESSAGES: Record<string, string> = {
  not_authorized: "This account isn't authorized. Ask your administrator to invite you first.",
  oauth: 'Single sign-on failed. Please try again.',
}

const TIMEOUT_MESSAGES: Record<string, string> = {
  idle: 'You were signed out after 30 minutes of inactivity.',
  expired: 'Your session reached its 12-hour limit. Please sign in again.',
}

const display = { fontFamily: 'var(--font-display)' } as const

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const params = useSearchParams()
  const urlError = params.get('error')
  const timeoutReason = params.get('timeout')
  const notice = timeoutReason
    ? (TIMEOUT_MESSAGES[timeoutReason] ?? 'Your session ended. Please sign in again.')
    : ''
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(urlError ? (ERROR_MESSAGES[urlError] ?? 'Sign-in failed. Please try again.') : '')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // If the account has 2FA enrolled, the session is still aal1 — go verify.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    window.location.href = aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2' ? '/login/mfa' : '/'
  }

  async function signInWith(provider: 'azure' | 'google') {
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) setError(error.message)
  }

  // SAML SSO by work-email domain. Redirects to the org's IdP once a SAML provider
  // is registered in Supabase for that domain; until then it explains the fallback.
  async function continueWithSSO() {
    setError('')
    const domain = email.split('@')[1]?.trim().toLowerCase()
    if (!domain) {
      setError('Enter your work email above, then continue with SSO.')
      return
    }
    const { data, error } = await supabase.auth.signInWithSSO({ domain })
    if (error || !data?.url) {
      setError("Single sign-on isn't set up for your organization yet — use Microsoft, Google, or email.")
      return
    }
    window.location.href = data.url
  }

  const inputClass =
    'w-full rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40'

  return (
    <div className="relative min-h-screen">
      {/* Mobile only: cover the body's top/bottom ambient bloom with a flat dark
          field, then a single violet glow behind the name + SSO (matches the mock).
          Desktop keeps the ambient bloom + two-column layout. */}
      <div aria-hidden className="fixed inset-0 bg-[#08080b] lg:hidden" />
      <div
        aria-hidden
        className="pointer-events-none fixed left-1/2 top-[30%] h-[24rem] w-[24rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl lg:hidden"
        style={{ background: 'radial-gradient(closest-side, rgba(124,92,255,0.38), rgba(124,92,255,0.10) 45%, transparent 72%)' }}
      />

      <div className="relative grid min-h-screen lg:grid-cols-2">
      {/* ── Left: brand / marketing (lg and up) ── */}
      <aside className="hidden lg:flex flex-col justify-between p-12 xl:p-16">
        <div>
          <BrandLockup markSize={30} />
        </div>

        <div className="max-w-xl">
          <h2 style={display} className="text-5xl font-bold leading-[1.05] tracking-tight text-white">
            One control plane for every endpoint.
          </h2>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-gray-400">
            Push apps, set allow/block policy, and see every managed device — from a single lightweight agent.
          </p>
        </div>

        <div className="flex gap-12">
          <div>
            <p style={display} className="text-xl font-semibold text-white">Windows · macOS · Linux</p>
            <p className="mt-1 text-sm text-gray-500">one lightweight agent per device</p>
          </div>
          <div>
            <p style={display} className="text-xl font-semibold text-white">Allow / block</p>
            <p className="mt-1 text-sm text-gray-500">policy enforced in real time</p>
          </div>
        </div>
      </aside>

      {/* ── Right: sign in ── */}
      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex justify-center lg:hidden">
            <BrandLockup markSize={46} />
          </div>

          {/* Heading — desktop only; mobile goes straight from the lockup to SSO */}
          <div className="hidden lg:block">
            <h1 style={display} className="text-3xl font-bold text-white">Sign in</h1>
            <p className="mt-2 text-gray-400">Welcome back. Use your work account.</p>
          </div>

          {notice && (
            <p className="mt-6 rounded-lg border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-sm text-amber-300">
              {notice}
            </p>
          )}

          {/* Primary: SAML SSO */}
          <button
            onClick={continueWithSSO}
            className="mt-4 lg:mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-base font-semibold text-white hover:bg-blue-700"
          >
            <LockIcon />
            Continue with SSO
          </button>

          {/* OAuth providers */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              onClick={() => signInWith('azure')}
              className="flex items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-800/60 py-3 text-sm font-medium text-white hover:bg-gray-700"
            >
              <MicrosoftIcon />
              Microsoft
            </button>
            <button
              onClick={() => signInWith('google')}
              className="flex items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-800/60 py-3 text-sm font-medium text-white hover:bg-gray-700"
            >
              <GoogleIcon />
              Google
            </button>
          </div>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-800" />
            <span className="text-xs text-gray-500">or email</span>
            <div className="h-px flex-1 bg-gray-800" />
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-300">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
                className={inputClass}
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-300">Password</label>
                <a href="/reset-password" className="text-xs text-blue-400 hover:underline">Forgot?</a>
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className={inputClass}
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl border border-gray-700 bg-gray-800/60 py-3 text-base font-semibold text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-gray-500">SSO · SAML · one lightweight agent</p>
        </div>
      </main>
      </div>
    </div>
  )
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function MicrosoftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.99 8.99 0 0 0 9 0 9 9 0 0 0 .96 4.95L3.97 7.28C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  )
}
