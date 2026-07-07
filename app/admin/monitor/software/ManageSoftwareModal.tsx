'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type PromoteTarget = {
  name: string
  publisher: string | null
  process_name: string | null
}

// Promote an observed app into the catalog (managed) as allowed or blocked. The
// process name is the enforcement key — pre-filled from inventory, editable
// because Windows can't always derive it. Blocking requires it.
export default function ManageSoftwareModal({
  target, onClose,
}: {
  target: PromoteTarget
  onClose: () => void
}) {
  const router = useRouter()
  const [processName, setProcessName] = useState(target.process_name ?? '')
  const [saving, setSaving] = useState<'allowed' | 'blocked' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function promote(status: 'allowed' | 'blocked') {
    if (saving) return
    if (status === 'blocked' && !processName.trim()) {
      setError('A process name is required to block — it is how the agent identifies the app.')
      return
    }
    setSaving(status); setError(null)
    try {
      const res = await fetch('/api/software/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: target.name, process_name: processName.trim(), status }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to add to catalog')
      router.refresh()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add to catalog')
      setSaving(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-white">Manage “{target.name}”</h2>
        <p className="mt-1 text-sm text-gray-500">
          Add this observed app to your catalog so it becomes managed. Block it to have agents close it, or allow it to track it without enforcing.
        </p>

        {target.publisher && (
          <p className="mt-4 text-sm text-gray-400">
            Publisher: <span className="text-gray-300">{target.publisher}</span>
          </p>
        )}

        <label className="mt-4 block text-sm font-medium text-gray-300">Process name</label>
        <input
          value={processName}
          onChange={e => setProcessName(e.target.value)}
          placeholder="e.g. Discord"
          className="mt-1.5 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-gray-500">The executable name the agent matches against. Required to block.</p>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={!!saving}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => promote('allowed')}
            disabled={!!saving}
            className="rounded-lg border border-gray-700 px-3 py-2 text-sm font-medium text-gray-200 hover:bg-gray-800 disabled:opacity-50"
          >
            {saving === 'allowed' ? 'Adding…' : 'Add as allowed'}
          </button>
          <button
            onClick={() => promote('blocked')}
            disabled={!!saving}
            className="rounded-lg bg-red-600/90 px-3 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
          >
            {saving === 'blocked' ? 'Blocking…' : 'Block'}
          </button>
        </div>
      </div>
    </div>
  )
}
