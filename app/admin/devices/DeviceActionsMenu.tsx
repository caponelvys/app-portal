'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Per-device actions dropdown (⋯). Navigation + portal actions are instant;
// restart/update/uninstall queue a command the agent picks up within a cycle.
export default function DeviceActionsMenu({
  deviceId,
  hostname,
  hasOwner,
}: {
  deviceId: string
  hostname: string
  hasOwner: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  async function post(url: string, body: object, okLabel: string, refresh = false) {
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch(url, { method: url.endsWith('/owner') ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setStatus({ text: data.error ?? 'Failed', error: true }); return }
      setStatus({ text: okLabel })
      if (refresh) { setOpen(false); router.refresh(); return }
      setTimeout(() => setOpen(false), 1500)
    } catch {
      setStatus({ text: 'Network error', error: true })
    } finally {
      setBusy(false)
    }
  }

  function command(cmd: string, confirmMsg: string, okLabel: string) {
    if (!confirm(confirmMsg)) return
    post(`/api/devices/${deviceId}/command`, { command: cmd }, okLabel)
  }

  function uninstall() {
    const typed = prompt(`This removes the agent from ${hostname} and stops enforcement. Type UNINSTALL to confirm.`)
    if (typed !== 'UNINSTALL') return
    post(`/api/devices/${deviceId}/command`, { command: 'uninstall' }, 'Uninstall queued')
  }

  function releaseOwner() {
    if (!confirm(`Release the owner of ${hostname}?`)) return
    post(`/api/devices/${deviceId}/owner`, { user_id: null }, 'Owner released', true)
  }

  const item = 'block w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 rounded-md'

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        aria-label="Device actions"
        className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 min-w-[32px] min-h-[32px] flex items-center justify-center"
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <circle cx="10" cy="4" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="10" cy="16" r="1.6" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-56 z-30 bg-gray-900 border border-gray-800 rounded-lg shadow-xl p-1">
          <a href={`/admin/devices/${deviceId}`} className={item}>Open details</a>
          <a href={`/admin/devices/${deviceId}/policies`} className={item}>View policies</a>
          <a href={`/api/devices/${deviceId}/logs`} download className={item}>Download logs</a>
          {hasOwner && <button onClick={releaseOwner} disabled={busy} className={`${item} disabled:opacity-50`}>Release owner</button>}
          <div className="my-1 border-t border-gray-800" />
          <button onClick={() => command('update', `Force ${hostname} to update to the latest agent now?`, 'Update queued')} disabled={busy} className={`${item} disabled:opacity-50`}>Force update now</button>
          <button onClick={() => command('restart', `Restart the agent on ${hostname}?`, 'Restart queued')} disabled={busy} className={`${item} disabled:opacity-50`}>Restart agent</button>
          <button onClick={uninstall} disabled={busy} className="block w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-950 rounded-md disabled:opacity-50">Uninstall agent</button>
          {status && <p className={`px-3 py-1.5 text-xs ${status.error ? 'text-red-400' : 'text-green-400'}`}>{status.text}</p>}
        </div>
      )}
    </div>
  )
}
