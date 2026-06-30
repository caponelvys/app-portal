'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RenameForm({ kind, id, currentName }: { kind: 'org' | 'location'; id: string; currentName: string }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(currentName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    const trimmed = name.trim()
    if (!trimmed || trimmed === currentName) { setEditing(false); return }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/orgs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, id, name: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'Failed to save'); return }
      setEditing(false)
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setBusy(false)
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2 group">
        <h1 className="text-2xl font-bold text-white">{name}</h1>
        <button
          onClick={() => setEditing(true)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-800 text-gray-500 hover:text-gray-300"
          title="Rename"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.536-6.536a2 2 0 012.828 2.828L11.828 15.828A2 2 0 0110 16.414V18h1.586a2 2 0 001.414-.586l.172-.172" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setName(currentName); setEditing(false) } }}
        className="text-2xl font-bold bg-gray-800 border border-gray-600 rounded-lg px-3 py-1 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-72"
      />
      <button onClick={save} disabled={busy} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
        {busy ? 'Saving…' : 'Save'}
      </button>
      <button onClick={() => { setName(currentName); setEditing(false) }} disabled={busy} className="text-sm text-gray-400 hover:text-white px-2">
        Cancel
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}
