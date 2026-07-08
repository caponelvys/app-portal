'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type App = { id: string; name: string }

export default function ElevateApp({ deviceId, apps }: { deviceId: string; apps: App[] }) {
  const router = useRouter()
  const [appId, setAppId] = useState(apps[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (apps.length === 0) {
    return (
      <p className="text-gray-500 text-sm">
        No apps are approved for elevated run. Mark an app &ldquo;Allow elevated run&rdquo; in its settings first.
      </p>
    )
  }

  async function run() {
    if (!appId || busy) return
    setBusy(true); setError(null); setMsg(null)
    try {
      const res = await fetch(`/api/apps/${appId}/elevate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to queue elevated run')
      setMsg('Queued — the app will launch with elevated privileges on the device shortly.')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to queue elevated run')
    } finally { setBusy(false) }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <select value={appId} onChange={e => setAppId(e.target.value)}
          className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none">
          {apps.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <button onClick={run} disabled={busy}
          className="rounded-lg border border-gray-700 px-3 py-2 text-sm font-medium text-blue-300 hover:border-blue-500/60 hover:bg-blue-600/10 disabled:opacity-50">
          {busy ? 'Queuing…' : 'Run elevated'}
        </button>
      </div>
      {msg && <p className="text-xs text-emerald-400">{msg}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
