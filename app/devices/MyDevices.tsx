'use client'

import { useEffect, useState } from 'react'

type Device = {
  device_id: string
  hostname: string
  os: string
  last_seen: string
}

export default function MyDevices() {
  const [mine, setMine] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Pairing form
  const [code, setCode] = useState('')
  const [pairing, setPairing] = useState(false)
  const [pairError, setPairError] = useState('')
  const [pairSuccess, setPairSuccess] = useState('')

  async function load() {
    const res = await fetch('/api/my-devices')
    const data = await res.json()
    setMine(data.mine ?? [])
    setLoading(false)
  }

  useEffect(() => {
    let active = true
    fetch('/api/my-devices')
      .then(r => r.json())
      .then(d => {
        if (!active) return
        setMine(d.mine ?? [])
        setLoading(false)
      })
    return () => { active = false }
  }, [])

  async function pair() {
    setPairing(true)
    setPairError('')
    setPairSuccess('')
    try {
      const res = await fetch('/api/my-devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pair', code }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPairError(data.error ?? 'Could not pair device')
        return
      }
      setPairSuccess(`Paired ${data.hostname || 'device'} successfully.`)
      setCode('')
      await load()
    } catch {
      setPairError('Network error')
    } finally {
      setPairing(false)
    }
  }

  async function release(device_id: string) {
    setBusy(device_id)
    setError('')
    try {
      const res = await fetch('/api/my-devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'release', device_id }),
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
      <section>
        <h2 className="text-lg font-semibold text-white mb-1">Pair a device</h2>
        <p className="text-sm text-gray-500 mb-4">
          Run the agent on your computer, then enter the pairing code it shows here to link it to your account.
        </p>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
          <input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="Enter pairing code"
            maxLength={12}
            className="flex-1 border border-gray-700 rounded-lg px-3 py-2 text-white bg-gray-800 tracking-widest font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={pair}
            disabled={pairing || code.trim().length === 0}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium whitespace-nowrap"
          >
            {pairing ? 'Pairing...' : 'Pair device'}
          </button>
        </div>
        {pairError && <p className="text-red-400 text-sm mt-2">{pairError}</p>}
        {pairSuccess && <p className="text-green-400 text-sm mt-2">{pairSuccess}</p>}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white mb-1">My devices</h2>
        <p className="text-sm text-gray-500 mb-4">
          Approved app access applies to the devices linked here.
        </p>
        {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
        {mine.length === 0 ? (
          <p className="text-gray-500 text-sm">No devices paired yet.</p>
        ) : (
          <div className="space-y-2">
            {mine.map(d => (
              <div key={d.device_id} className="bg-gray-900 rounded-xl border border-gray-800 px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-white font-medium truncate">{d.hostname || 'Unknown device'}</p>
                  <p className="text-xs text-gray-500">
                    {d.os} · last seen {new Date(d.last_seen).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => release(d.device_id)}
                  disabled={busy === d.device_id}
                  className="text-xs px-3 py-1.5 rounded-md border border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-50 whitespace-nowrap"
                >
                  {busy === d.device_id ? '...' : 'Release'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
