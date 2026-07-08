'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Two-click confirm (native confirm() is suppressed in this app's menus), then
// copies this ring's policies to the next ring.
export default function PromoteRing({
  ringId, ringName, nextName, overrideCount,
}: {
  ringId: string
  ringName: string
  nextName: string
  overrideCount: number
}) {
  const router = useRouter()
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function promote() {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/rings/${ringId}/promote`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Promote failed')
      setMsg(`Promoted ${data.count} to ${data.promotedTo}`)
      setArmed(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Promote failed')
      setArmed(false)
    } finally { setBusy(false) }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {armed ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Copy {overrideCount} to {nextName}?</span>
          <button onClick={promote} disabled={busy}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
            {busy ? 'Promoting…' : 'Confirm'}
          </button>
          <button onClick={() => setArmed(false)} disabled={busy}
            className="rounded-lg px-2 py-1.5 text-sm text-gray-400 hover:text-gray-200">Cancel</button>
        </div>
      ) : (
        <button onClick={() => { setArmed(true); setMsg(null); setError(null) }}
          className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm font-medium text-blue-300 hover:border-blue-500/60 hover:bg-blue-600/10">
          Promote to {nextName} →
        </button>
      )}
      {msg && <span className="text-xs text-emerald-400">{msg}</span>}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}
