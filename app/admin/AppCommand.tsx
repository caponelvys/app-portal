'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type App = { id: string; name: string }
type Scope = 'device' | 'location' | 'org' | 'fleet'
type Action = 'install' | 'uninstall'

// Pick a managed app and queue an install or uninstall across a scope (one
// device, a location, an org, or the whole fleet). Confirmation is a two-click
// inline flow (no native confirm()/prompt() — browsers can silently suppress
// those). Results land in the target's Activity / the Agent Monitor.
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
  const [confirming, setConfirming] = useState(false)
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null)

  const single = scope === 'device'
  const Verb = action === 'install' ? 'Install' : 'Uninstall'
  const buttonLabel = single ? `${Verb} on this device`
    : scope === 'fleet' ? `${Verb} across fleet`
    : `${Verb} across ${targetLabel}`
  const app = apps.find(a => a.id === appId)
  const destructiveBulk = action === 'uninstall' && !single

  function onSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    setAppId(e.target.value)
    setConfirming(false)
    setStatus(null)
  }

  function onButton() {
    if (!appId || busy) return
    if (!confirming) { setConfirming(true); return }
    doSubmit()
  }

  async function doSubmit() {
    if (!app) return
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch(`/api/apps/${appId}/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, scopeId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setStatus({ text: data.error ?? 'Failed to queue', error: true }); setConfirming(false); return }
      const n = data.queued ?? 0
      setStatus({
        text: single
          ? `${Verb} of ${app.name} queued — the agent runs it within a few seconds.`
          : `${Verb} of ${app.name} queued for ${n} device${n === 1 ? '' : 's'}. Watch the Agent Monitor for results.`,
      })
      setAppId('')
      setConfirming(false)
      router.refresh()
    } catch {
      setStatus({ text: 'Network error', error: true })
    } finally {
      setBusy(false)
    }
  }

  const baseColor = action === 'install'
    ? 'border-green-700 text-green-300 hover:bg-green-950'
    : 'border-orange-700 text-orange-300 hover:bg-orange-950'
  const confirmColor = action === 'install'
    ? 'border-green-700 bg-green-700 text-white hover:bg-green-600'
    : 'border-orange-700 bg-orange-700 text-white hover:bg-orange-600'

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={appId} onChange={onSelect}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-[200px]">
          <option value="">Select an app…</option>
          {apps.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <button onClick={onButton} disabled={!appId || busy}
          className={`text-sm px-4 py-2 rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed font-medium ${confirming ? confirmColor : baseColor}`}>
          {busy ? 'Queuing…' : confirming ? 'Click again to confirm' : buttonLabel}
        </button>
        {confirming && !busy && (
          <button onClick={() => setConfirming(false)} className="text-xs text-gray-400 hover:text-gray-200">Cancel</button>
        )}
      </div>
      {confirming && destructiveBulk && app && (
        <p className="mt-2 text-xs text-orange-300">Removes {app.name} from every device in {targetLabel} where it&apos;s found. This can&apos;t be undone.</p>
      )}
      {status && <p className={`mt-2 text-xs ${status.error ? 'text-red-400' : 'text-green-400'}`}>{status.text}</p>}
    </div>
  )
}
