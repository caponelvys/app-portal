'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type App = { id: string; name: string }
type Scope = 'device' | 'location' | 'org' | 'fleet'

// Pick a managed app and queue a remote uninstall across a scope (one device, a
// location, an org, or the whole fleet). Single-device is a plain confirm;
// multi-device scopes require typing the app name since they're bulk-destructive.
// Results land in the target's Activity / the Agent Monitor.
export default function AppUninstall({
  apps, scope, scopeId, targetLabel,
}: {
  apps: App[]
  scope: Scope
  scopeId?: string
  targetLabel: string   // e.g. a hostname, "this location", "Acme Corp"
}) {
  const router = useRouter()
  const [appId, setAppId] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null)

  const single = scope === 'device'
  const buttonLabel = single ? 'Uninstall from this device'
    : scope === 'fleet' ? 'Uninstall from fleet'
    : `Uninstall across ${targetLabel}`

  async function submit() {
    const app = apps.find(a => a.id === appId)
    if (!app) return
    if (single) {
      if (!confirm(`Uninstall "${app.name}" from ${targetLabel}?\n\nThis removes the app from the device and cannot be undone.`)) return
    } else {
      const typed = prompt(`Uninstall "${app.name}" from ALL devices in ${targetLabel}?\n\nThis removes it from every machine where it is found and cannot be undone. Type the app name to confirm.`)
      if (typed !== app.name) return
    }
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch(`/api/apps/${appId}/uninstall`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, scopeId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setStatus({ text: data.error ?? 'Failed to queue', error: true }); return }
      const n = data.queued ?? 0
      setStatus({
        text: single
          ? `Uninstall of ${app.name} queued — the agent runs it within a few seconds.`
          : `Uninstall of ${app.name} queued for ${n} device${n === 1 ? '' : 's'}. Watch the Agent Monitor for results.`,
      })
      setAppId('')
      router.refresh()
    } catch {
      setStatus({ text: 'Network error', error: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={appId} onChange={e => setAppId(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-[200px]">
          <option value="">Select an app…</option>
          {apps.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <button onClick={submit} disabled={!appId || busy}
          className="text-sm px-4 py-2 rounded-lg border border-orange-700 text-orange-300 hover:bg-orange-950 disabled:opacity-40 disabled:cursor-not-allowed font-medium">
          {busy ? 'Queuing…' : buttonLabel}
        </button>
      </div>
      {status && <p className={`mt-2 text-xs ${status.error ? 'text-red-400' : 'text-green-400'}`}>{status.text}</p>}
    </div>
  )
}
