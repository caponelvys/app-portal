'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CaptureSnapshot({ period }: { period: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function capture() {
    setBusy(true); setError(null); setMsg(null)
    try {
      const res = await fetch('/api/usage/capture', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Capture failed')
      setMsg(`Captured ${data.orgs} org${data.orgs === 1 ? '' : 's'} for ${period}`)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Capture failed')
    } finally { setBusy(false) }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button onClick={capture} disabled={busy}
        className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm font-medium text-blue-300 hover:border-blue-500/60 hover:bg-blue-600/10 disabled:opacity-50">
        {busy ? 'Capturing…' : `Capture ${period}`}
      </button>
      {msg && <span className="text-xs text-emerald-400">{msg}</span>}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}
