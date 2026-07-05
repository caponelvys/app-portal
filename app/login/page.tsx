'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="bg-gray-900 border border-gray-800 p-8 rounded-xl shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-white">Sign in</h1>

        {notice && (
          <p className="mb-4 text-sm text-amber-300 bg-amber-950/40 border border-amber-900/60 rounded-lg px-3 py-2">
            {notice}
          </p>
        )}

        <div className="space-y-2 mb-4">
          <button
            onClick={() => signInWith('azure')}
            className="w-full flex items-center justify-center gap-2 border border-gray-700 bg-gray-800 text-white py-2 rounded-lg hover:bg-gray-700 font-medium"
          >
            <MicrosoftIcon />
            Continue with Microsoft
          </button>
          <button
            onClick={() => signInWith('google')}
            className="w-full flex items-center justify-center gap-2 border border-gray-700 bg-gray-800 text-white py-2 rounded-lg hover:bg-gray-700 font-medium"
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </div>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-xs text-gray-500">or</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white bg-gray-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white bg-gray-800"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-4 text-sm text-gray-400 text-center">
          <a href="/reset-password" className="text-blue-400 hover:underline">Forgot password?</a>
        </p>
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
