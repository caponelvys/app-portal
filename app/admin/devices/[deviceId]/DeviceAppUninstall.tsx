'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type App = { id: string; name: string }

// Queue a remote uninstall of a single app on this device. The agent picks it up
// within a poll cycle, removes the app, and reports the result into the Activity
// feed below (App uninstalled / App uninstall failed).
export default function DeviceAppUninstall({
  deviceId, hostname, apps,
}: {
  deviceId: string
  hostname: string
  apps: App[]
}) {
  const router = useRouter()
  const [appId, setAppId] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null)

  async function submit() {
    const app = apps.find(a => a.id === appId)
    if (!app) return
    if (!confirm(`Uninstall "${app.name}" from ${hostname}?\n\nThis removes the app from the device and cannot be undone.`)) return
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch(`/api/devices/${deviceId}/uninstall-app`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setStatus({ text: data.error ?? 'Failed to queue', error: true }); return }
      setStatus({ text: `Uninstall of ${app.name} queued — the agent runs it within a few seconds.` })
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
          {busy ? 'Queuing…' : 'Uninstall from this device'}
        </button>
      </div>
      {status && <p className={`mt-2 text-xs ${status.error ? 'text-red-400' : 'text-green-400'}`}>{status.text}</p>}
    </div>
  )
}
