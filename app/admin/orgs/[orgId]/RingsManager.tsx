'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Ring = { id: string; name: string; position: number; deviceCount: number }

export default function RingsManager({ orgId, rings }: { orgId: string; rings: Ring[] }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function post(body: object, key: string) {
    setBusy(key); setError(null)
    try {
      const res = await fetch('/api/rings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed')
      setName('')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(null) }
  }

  async function remove(id: string) {
    setBusy(`del-${id}`); setError(null)
    try {
      const res = await fetch(`/api/rings/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    } finally { setBusy(null) }
  }

  const nextPosition = rings.length ? Math.max(...rings.map(r => r.position)) + 1 : 0

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <h2 className="text-lg font-semibold text-white mb-1">Rollout rings</h2>
      <p className="text-gray-500 text-sm mb-4">
        Stage policy changes through ordered rings so a change is validated on a few devices before it reaches production.
      </p>

      {rings.length === 0 ? (
        <button
          onClick={() => post({ org_id: orgId, defaults: true }, 'defaults')}
          disabled={!!busy}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {busy === 'defaults' ? 'Creating…' : 'Create Test · Pilot · Production'}
        </button>
      ) : (
        <ol className="space-y-2">
          {rings.map((r, i) => (
            <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-800 bg-gray-950 px-4 py-2.5">
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-800 text-xs font-mono text-gray-400 shrink-0">{i + 1}</span>
                <a href={`/admin/rings/${r.id}`} className="font-medium text-blue-400 hover:text-blue-300 truncate">{r.name}</a>
                <span className="text-xs text-gray-500 shrink-0">{r.deviceCount} device{r.deviceCount === 1 ? '' : 's'}</span>
              </div>
              <button
                onClick={() => remove(r.id)}
                disabled={!!busy}
                className="rounded-md border border-gray-700 px-2.5 py-1 text-xs font-medium text-gray-400 hover:border-red-500/50 hover:text-red-300 disabled:opacity-50 shrink-0"
              >
                {busy === `del-${r.id}` ? '…' : 'Delete'}
              </button>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-4 flex items-center gap-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Add a ring (e.g. Canary)"
          className="flex-1 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
        />
        <button
          onClick={() => post({ org_id: orgId, name, position: nextPosition }, 'add')}
          disabled={!name.trim() || !!busy}
          className="rounded-lg border border-gray-700 px-3 py-2 text-sm font-medium text-gray-200 hover:bg-gray-800 disabled:opacity-50"
        >
          {busy === 'add' ? 'Adding…' : 'Add'}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  )
}
