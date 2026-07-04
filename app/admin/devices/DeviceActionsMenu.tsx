'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Per-device actions dropdown (⋯). Navigation + portal actions are instant;
// restart/update/uninstall queue a command the agent picks up within a cycle.
// The menu uses fixed positioning so it isn't clipped by the table's overflow.
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
  const [confirmingUninstall, setConfirmingUninstall] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null)
  const [coords, setCoords] = useState<{ top: number; right: number }>({ top: 0, right: 0 })
  const wrapRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function close() { setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    // Fixed menu doesn't follow the button, so close it if the page/table moves.
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  function toggle(e: React.MouseEvent) {
    e.stopPropagation()
    if (open) { setOpen(false); return }
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setCoords({ top: r.bottom + 4, right: window.innerWidth - r.right })
    setStatus(null)
    setConfirmingUninstall(false)
    setConfirmingDelete(false)
    setOpen(true)
  }

  async function post(url: string, method: 'POST' | 'PATCH', body: object, okLabel: string, refresh = false) {
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
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
    post(`/api/devices/${deviceId}/command`, 'POST', { command: cmd }, okLabel)
  }

  function uninstall() {
    // Inline two-click confirm — no native prompt()/confirm() (browsers can
    // silently suppress those, which made this action look dead).
    post(`/api/devices/${deviceId}/command`, 'POST', { command: 'uninstall' }, 'Uninstall queued')
    setConfirmingUninstall(false)
  }

  function releaseOwner() {
    if (!confirm(`Release the owner of ${hostname}?`)) return
    post(`/api/devices/${deviceId}/owner`, 'PATCH', { user_id: null }, 'Owner released', true)
  }

  async function deleteDevice() {
    // Remove the device record from the portal (for decommissioned machines).
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch(`/api/devices/${deviceId}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setStatus({ text: data.error ?? 'Failed', error: true }); setConfirmingDelete(false); return }
      setOpen(false)
      router.push('/admin/devices')
      router.refresh()
    } catch {
      setStatus({ text: 'Network error', error: true })
    } finally {
      setBusy(false)
    }
  }

  const item = 'block w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 rounded-md disabled:opacity-50'

  return (
    <div className="inline-block" ref={wrapRef}>
      <button
        ref={btnRef}
        onClick={toggle}
        aria-label="Device actions"
        className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 min-w-[32px] min-h-[32px] flex items-center justify-center"
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <circle cx="10" cy="4" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="10" cy="16" r="1.6" />
        </svg>
      </button>
      {open && (
        <div
          style={{ position: 'fixed', top: coords.top, right: coords.right }}
          className="w-56 z-50 bg-gray-900 border border-gray-800 rounded-lg shadow-xl p-1"
        >
          <a href={`/admin/devices/${deviceId}`} className={item}>Open details</a>
          <a href={`/admin/devices/${deviceId}/policies`} className={item}>View policies</a>
          <a href={`/api/devices/${deviceId}/logs`} download className={item}>Download logs</a>
          {hasOwner && <button onClick={releaseOwner} disabled={busy} className={item}>Release owner</button>}
          <div className="my-1 border-t border-gray-800" />
          <button onClick={() => command('update', `Force ${hostname} to update to the latest agent now?`, 'Update queued')} disabled={busy} className={item}>Force update now</button>
          <button onClick={() => command('restart', `Restart the agent on ${hostname}?`, 'Restart queued')} disabled={busy} className={item}>Restart agent</button>
          {confirmingUninstall ? (
            <button onClick={uninstall} disabled={busy} className="block w-full text-left px-3 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-600 rounded-md disabled:opacity-50">
              Click again to remove the agent
            </button>
          ) : (
            <button onClick={() => setConfirmingUninstall(true)} disabled={busy} className="block w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-950 rounded-md disabled:opacity-50">
              Uninstall agent
            </button>
          )}
          {confirmingDelete ? (
            <button onClick={deleteDevice} disabled={busy} className="block w-full text-left px-3 py-2 text-sm font-medium text-white bg-red-800 hover:bg-red-700 rounded-md disabled:opacity-50">
              Click again to delete from portal
            </button>
          ) : (
            <button onClick={() => setConfirmingDelete(true)} disabled={busy} className="block w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-950 rounded-md disabled:opacity-50" title="Remove this device's record from the portal">
              Delete from portal
            </button>
          )}
          {status && <p className={`px-3 py-1.5 text-xs ${status.error ? 'text-red-400' : 'text-green-400'}`}>{status.text}</p>}
        </div>
      )}
    </div>
  )
}
