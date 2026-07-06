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

  return (
    <div className="min-h-screen flex items-center justify-center bg-transparent px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900/70 backdrop-blur-sm p-8 sm:p-10 shadow-xl">
        <div>
          <div className="flex justify-center mb-5">
            <BrandLockup markSize={44} />
          </div>
          <h1 className="text-3xl font-bold text-white text-center">Sign in</h1>
          <p className="mt-2 mb-8 text-center text-gray-400">Control plane for every endpoint</p>

          {notice && (
            <p className="mb-5 text-sm text-amber-300 bg-amber-950/40 border border-amber-900/60 rounded-lg px-3 py-2">
              {notice}
            </p>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-300">Password</label>
                <a href="/reset-password" className="text-xs text-blue-400 hover:underline">Forgot password?</a>
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-xs text-gray-500">or continue with</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => signInWith('azure')}
              className="flex items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-800 py-2.5 text-sm font-medium text-white hover:bg-gray-700"
            >
              <MicrosoftIcon />
              Microsoft
            </button>
            <button
              onClick={() => signInWith('google')}
              className="flex items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-800 py-2.5 text-sm font-medium text-white hover:bg-gray-700"
            >
              <GoogleIcon />
              Google
            </button>
          </div>

          <p className="mt-8 text-center text-xs text-gray-500">SSO · SAML · one lightweight agent</p>
        </div>
      </div>
    </div>
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
