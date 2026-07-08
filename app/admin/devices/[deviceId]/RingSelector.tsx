'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Ring = { id: string; name: string }

export default function RingSelector({
  deviceId, current, rings,
}: {
  deviceId: string
  current: string | null
  rings: Ring[]
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function set(ringId: string) {
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/devices/${deviceId}/ring`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ring_id: ringId || null }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to update ring')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update ring')
    } finally { setSaving(false) }
  }

  if (rings.length === 0) {
    return <p className="text-sm text-gray-500">No rollout rings defined for this organization yet.</p>
  }

  return (
    <div className="flex flex-col gap-1.5">
      <select
        value={current ?? ''}
        onChange={e => set(e.target.value)}
        disabled={saving}
        className="w-fit rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none disabled:opacity-60"
      >
        <option value="">Unassigned</option>
        {rings.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
