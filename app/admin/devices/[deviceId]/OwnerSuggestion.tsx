'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Shown when a device is unclaimed but its reported OS user matches a portal
// account. Lets an admin accept the suggested owner with one click.
export default function OwnerSuggestion({
  deviceId,
  osUser,
  suggestion,
}: {
  deviceId: string
  osUser: string
  suggestion: { id: string; email: string }
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function assign() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/devices/${deviceId}/owner`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: suggestion.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Failed to assign owner')
        return
      }
      setDone(true)
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setBusy(false)
    }
  }

  if (done) return null

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 bg-blue-950/40 border border-blue-900 rounded-lg px-4 py-3">
      <p className="text-sm text-blue-200 flex-1 min-w-0">
        OS user <span className="font-mono text-blue-100">{osUser}</span> looks like{' '}
        <span className="font-medium text-white">{suggestion.email}</span>. Assign as owner?
      </p>
      <button
        onClick={assign}
        disabled={busy}
        className="shrink-0 text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 font-medium"
      >
        {busy ? 'Assigning…' : 'Assign owner'}
      </button>
      {error && <p className="text-xs text-red-400 w-full">{error}</p>}
    </div>
  )
}
