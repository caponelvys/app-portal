'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Change = {
  id: string
  app: string
  scope_type: string
  scope_name: string
  old_status: string | null
  new_status: string | null
  actor: string
  at: string
}

function StatusPill({ status }: { status: string | null }) {
  if (status === 'blocked') return <span className="text-red-300">Blocked</span>
  if (status === 'allowed') return <span className="text-emerald-300">Allowed</span>
  return <span className="text-gray-500">Inherit</span>
}

const SCOPE_LABEL: Record<string, string> = { org: 'org', location: 'location', device: 'device', ring: 'ring' }

export default function PolicyHistoryTable({ history }: { history: Change[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function revert(id: string) {
    setBusy(id); setError(null)
    try {
      const res = await fetch('/api/policies/revert', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ change_id: id }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Revert failed')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Revert failed')
    } finally { setBusy(null) }
  }

  if (history.length === 0) {
    return <p className="text-sm text-gray-500">No policy changes recorded yet.</p>
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-red-400">{error}</p>}
      {history.map(c => (
        <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-900 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm text-white">
              <span className="font-medium">{c.app}</span>
              <span className="text-gray-500"> · {c.scope_name} <span className="text-gray-600">({SCOPE_LABEL[c.scope_type] ?? c.scope_type})</span></span>
            </p>
            <p className="mt-0.5 text-xs">
              <StatusPill status={c.old_status} /> <span className="text-gray-600">→</span> <StatusPill status={c.new_status} />
              <span className="text-gray-500"> · {c.actor} · {new Date(c.at).toLocaleString()}</span>
            </p>
          </div>
          <button
            onClick={() => revert(c.id)}
            disabled={!!busy}
            className="rounded-md border border-gray-700 px-2.5 py-1 text-xs font-medium text-gray-300 hover:border-blue-500/50 hover:text-blue-300 disabled:opacity-50 shrink-0"
          >
            {busy === c.id ? '…' : 'Revert'}
          </button>
        </div>
      ))}
    </div>
  )
}
