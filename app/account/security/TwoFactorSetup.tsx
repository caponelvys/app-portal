'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Factor = { id: string; friendly_name: string | null; status: string }

export default function TwoFactorSetup({ required }: { required: boolean }) {
  const [factors, setFactors] = useState<Factor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Enrollment-in-progress state
  const [enrolling, setEnrolling] = useState(false)
  const [qr, setQr] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)

  async function loadFactors() {
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) { setError(error.message); setLoading(false); return }
    setFactors((data?.all ?? []).map(f => ({ id: f.id, friendly_name: f.friendly_name ?? null, status: f.status })))
    setLoading(false)
  }

  useEffect(() => {
    let active = true
    supabase.auth.mfa.listFactors().then(({ data, error }) => {
      if (!active) return
      if (error) { setError(error.message); setLoading(false); return }
      setFactors((data?.all ?? []).map(f => ({ id: f.id, friendly_name: f.friendly_name ?? null, status: f.status })))
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  async function startEnroll() {
    setError('')
    setEnrolling(true)
    // Clean up any leftover unverified factor so enroll doesn't collide.
    const { data: list } = await supabase.auth.mfa.listFactors()
    for (const f of list?.all ?? []) {
      if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id })
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
    if (error) { setError(error.message); setEnrolling(false); return }
    setQr(data.totp.qr_code)
    setSecret(data.totp.secret)
    setFactorId(data.id)
  }

  async function confirmEnroll() {
    if (!factorId) return
    setVerifying(true)
    setError('')
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() })
    setVerifying(false)
    if (error) { setError(error.message); return }
    cancelEnroll()
    await loadFactors()
  }

  function cancelEnroll() {
    setEnrolling(false)
    setQr(null); setSecret(null); setFactorId(null); setCode('')
  }

  async function remove(id: string) {
    if (!confirm('Remove this authenticator? You may be asked to set up 2FA again.')) return
    setError('')
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id })
    if (error) { setError(error.message); return }
    await loadFactors()
  }

  const verified = factors.filter(f => f.status === 'verified')

  if (loading) return <p className="text-gray-500 text-sm">Loading...</p>

  return (
    <div className="space-y-6">
      {required && verified.length === 0 && (
        <div className="bg-yellow-950 border border-yellow-800 text-yellow-300 text-sm rounded-lg px-4 py-3">
          Two-factor authentication is required for your role. Set it up below to continue.
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Authenticator app (TOTP)</h2>
        <p className="text-sm text-gray-500 mb-3">
          Use an app like 1Password, Authy, or Google Authenticator for time-based codes.
        </p>

        {verified.length > 0 && (
          <div className="space-y-2 mb-4">
            {verified.map(f => (
              <div key={f.id} className="bg-gray-900 rounded-xl border border-gray-800 px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-white">
                  {f.friendly_name || 'Authenticator'}
                  <span className="ml-2 text-xs text-green-400">● Active</span>
                </span>
                <button onClick={() => remove(f.id)} className="text-xs text-red-400 border border-red-900 rounded px-3 py-1.5 hover:bg-red-950">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {!enrolling ? (
          <button onClick={startEnroll} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
            {verified.length > 0 ? 'Add another authenticator' : 'Set up 2FA'}
          </button>
        ) : (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
            {qr ? (
              <>
                <p className="text-sm text-gray-300">1. Scan this QR code with your authenticator app:</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="2FA QR code" className="w-44 h-44 bg-white rounded-lg p-2" />
                {secret && (
                  <p className="text-xs text-gray-500 break-all">
                    Or enter this key manually: <span className="font-mono text-gray-300">{secret}</span>
                  </p>
                )}
                <p className="text-sm text-gray-300">2. Enter the 6-digit code it shows:</p>
                <div className="flex items-center gap-2">
                  <input
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    inputMode="numeric"
                    className="w-32 border border-gray-700 rounded-lg px-3 py-2 text-white bg-gray-800 tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button onClick={confirmEnroll} disabled={verifying || code.length !== 6}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                    {verifying ? 'Verifying...' : 'Verify & enable'}
                  </button>
                  <button onClick={cancelEnroll} disabled={verifying} className="text-sm text-gray-400 hover:text-gray-200 px-2">
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500">Preparing…</p>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  )
}
