'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function MfaChallengePage() {
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    let active = true
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data: aal }) => {
      if (!active) return
      // Already at aal2 (or no factor) — nothing to challenge.
      if (!aal || aal.currentLevel === 'aal2' || aal.nextLevel !== 'aal2') {
        window.location.href = '/'
        return
      }
      supabase.auth.mfa.listFactors().then(({ data, error }) => {
        if (!active) return
        if (error) { setError(error.message); setLoading(false); return }
        const totp = (data?.totp ?? []).find(f => f.status === 'verified')
        if (!totp) { window.location.href = '/'; return }
        setFactorId(totp.id)
        setLoading(false)
      })
    })
    return () => { active = false }
  }, [])

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    if (!factorId) return
    setVerifying(true)
    setError('')
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() })
    if (error) {
      setError(error.message)
      setVerifying(false)
      return
    }
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="bg-gray-900 border border-gray-800 p-8 rounded-xl shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-2 text-white">Two-factor verification</h1>
        <p className="text-sm text-gray-400 mb-6">Enter the 6-digit code from your authenticator app.</p>

        {loading ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : (
          <form onSubmit={verify} className="space-y-4">
            <input
              autoFocus
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              inputMode="numeric"
              className="w-full border border-gray-700 rounded-lg px-3 py-2 text-white bg-gray-800 tracking-[0.5em] text-center text-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" disabled={verifying || code.length !== 6}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
              {verifying ? 'Verifying…' : 'Verify'}
            </button>
          </form>
        )}

        <p className="mt-4 text-sm text-gray-500 text-center">
          Lost your device? <a href="/auth/signout" className="text-blue-400 hover:underline">Sign out</a> and contact your administrator.
        </p>
      </div>
    </div>
  )
}
