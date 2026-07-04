'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type App = { id: string; name: string }
type Scope = 'device' | 'location' | 'org' | 'fleet'
type Action = 'install' | 'uninstall'

// Pick a managed app and queue an install or uninstall across a scope (one
// device, a location, an org, or the whole fleet). Uninstall across multiple
// devices requires typing the app name (destructive); install and single-device
// use a plain confirm. Results land in the target's Activity / the Agent Monitor.
export default function AppCommand({
  apps, action, scope, scopeId, targetLabel,
}: {
  apps: App[]
  action: Action
  scope: Scope
  scopeId?: string
  targetLabel: string   // a hostname, "this location", an org name, etc.
}) {
  const router = useRouter()
  const [appId, setAppId] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null)

  const single = scope === 'device'
  const Verb = action === 'install' ? 'Install' : 'Uninstall'
  const buttonLabel = single ? `${Verb} on this device`
    : scope === 'fleet' ? `${Verb} across fleet`
    : `${Verb} across ${targetLabel}`

  async function submit() {
    const app = apps.find(a => a.id === appId)
    if (!app) return
    if (single) {
      const prep = action === 'install' ? 'on' : 'from'
      if (!confirm(`${Verb} "${app.name}" ${prep} ${targetLabel}?`)) return
    } else if (action === 'uninstall') {
      const typed = prompt(`Uninstall "${app.name}" from ALL devices in ${targetLabel}?\n\nThis removes it from every machine where it is found and cannot be undone. Type the app name to confirm.`)
      if (typed !== app.name) return
    } else {
      if (!confirm(`Install "${app.name}" on ALL devices in ${targetLabel}?`)) return
    }
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch(`/api/apps/${appId}/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, scopeId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setStatus({ text: data.error ?? 'Failed to queue', error: true }); return }
      const n = data.queued ?? 0
      setStatus({
        text: single
          ? `${Verb} of ${app.name} queued — the agent runs it within a few seconds.`
          : `${Verb} of ${app.name} queued for ${n} device${n === 1 ? '' : 's'}. Watch the Agent Monitor for results.`,
      })
      setAppId('')
      router.refresh()
    } catch {
      setStatus({ text: 'Network error', error: true })
    } finally {
      setBusy(false)
    }
  }

  const btnColor = action === 'install'
    ? 'border-green-700 text-green-300 hover:bg-green-950'
    : 'border-orange-700 text-orange-300 hover:bg-orange-950'

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={appId} onChange={e => setAppId(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-[200px]">
          <option value="">Select an app…</option>
          {apps.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <button onClick={submit} disabled={!appId || busy}
          className={`text-sm px-4 py-2 rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed font-medium ${btnColor}`}>
          {busy ? 'Queuing…' : buttonLabel}
        </button>
      </div>
      {status && <p className={`mt-2 text-xs ${status.error ? 'text-red-400' : 'text-green-400'}`}>{status.text}</p>}
    </div>
  )
}
