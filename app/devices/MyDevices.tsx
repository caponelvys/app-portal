'use client'

import { useEffect, useState } from 'react'

type Device = {
  device_id: string
  hostname: string
  os: string
  last_seen: string
  user_id: string | null
}

export default function MyDevices() {
  const [mine, setMine] = useState<Device[]>([])
  const [unclaimed, setUnclaimed] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function load() {
    const res = await fetch('/api/my-devices')
    const data = await res.json()
    setMine(data.mine ?? [])
    setUnclaimed(data.unclaimed ?? [])
    setLoading(false)
  }

  useEffect(() => {
    let active = true
    fetch('/api/my-devices')
      .then(r => r.json())
      .then(d => {
        if (!active) return
        setMine(d.mine ?? [])
        setUnclaimed(d.unclaimed ?? [])
        setLoading(false)
      })
    return () => { active = false }
  }, [])

  async function act(device_id: string, action: 'claim' | 'release') {
    setBusy(device_id)
    setError('')
    try {
      const res = await fetch('/api/my-devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id, action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Action failed')
        return
      }
      await load()
    } catch {
      setError('Network error')
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <p className="text-gray-500 text-sm">Loading...</p>

  return (
    <div className="space-y-8">
      {error && <p className="text-red-400 text-sm">{error}</p>}

      <section>
        <h2 className="text-lg font-semibold text-white mb-1">My devices</h2>
        <p className="text-sm text-gray-500 mb-4">
          Approved app access applies to the devices you claim here.
        </p>
        {mine.length === 0 ? (
          <p className="text-gray-500 text-sm">You haven&apos;t claimed any devices yet.</p>
        ) : (
          <div className="space-y-2">
            {mine.map(d => (
              <DeviceRow key={d.device_id} device={d} busy={busy === d.device_id}
                action="release" onAction={() => act(d.device_id, 'release')} />
            ))}
          </div>
        )}
      </section>

      {unclaimed.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-1">Unclaimed devices</h2>
          <p className="text-sm text-gray-500 mb-4">
            Devices running the agent that aren&apos;t linked to anyone yet. Claim the ones that are yours.
          </p>
          <div className="space-y-2">
            {unclaimed.map(d => (
              <DeviceRow key={d.device_id} device={d} busy={busy === d.device_id}
                action="claim" onAction={() => act(d.device_id, 'claim')} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function DeviceRow({
  device, busy, action, onAction,
}: {
  device: Device
  busy: boolean
  action: 'claim' | 'release'
  onAction: () => void
}) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-white font-medium truncate">{device.hostname || 'Unknown device'}</p>
        <p className="text-xs text-gray-500">
          {device.os} · last seen {new Date(device.last_seen).toLocaleString()}
        </p>
      </div>
      <button
        onClick={onAction}
        disabled={busy}
        className={
          action === 'claim'
            ? 'text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap'
            : 'text-xs px-3 py-1.5 rounded-md border border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-50 whitespace-nowrap'
        }
      >
        {busy ? '...' : action === 'claim' ? 'This is mine' : 'Release'}
      </button>
    </div>
  )
}
