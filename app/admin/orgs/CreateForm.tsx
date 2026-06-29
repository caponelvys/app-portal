'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Inline "add" form used for both orgs and locations.
export default function CreateForm({
  kind,
  orgId,
  label,
}: {
  kind: 'org' | 'location'
  orgId?: string
  label: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, name, org_id: orgId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Failed to create')
        return
      }
      setName('')
      setOpen(false)
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
      >
        {label}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit() }}
        placeholder={kind === 'org' ? 'Organization name' : 'Location name'}
        className="border border-gray-700 rounded-lg px-3 py-2 text-sm text-white bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        onClick={submit}
        disabled={busy || name.trim().length === 0}
        className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
      >
        {busy ? 'Adding...' : 'Add'}
      </button>
      <button onClick={() => setOpen(false)} disabled={busy} className="text-sm text-gray-400 hover:text-gray-200 px-2">
        Cancel
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}
