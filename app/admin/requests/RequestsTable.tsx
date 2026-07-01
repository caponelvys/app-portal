'use client'

import { useEffect, useState } from 'react'
import { durationLabel, isGrantActive, expiresInLabel } from '@/lib/durations'
import DataTable, { ColDef } from '@/app/admin/DataTable'

type Request = {
  id: string
  app_name: string
  user_email: string | null
  reason: string | null
  duration: string
  status: string
  expires_at: string | null
  created_at: string
}

function StatusBadge({ req }: { req: Request }) {
  if (req.status === 'pending')
    return <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-900 text-yellow-400">Pending</span>
  if (req.status === 'denied')
    return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-950 text-red-400">Denied</span>
  if (req.status === 'revoked')
    return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-950 text-red-400">Revoked</span>
  if (req.status === 'expired')
    return <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-800 text-gray-400">Expired</span>
  // approved
  const active = isGrantActive(req.status, req.expires_at)
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${active ? 'bg-green-950 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
      {active ? `Approved · ${expiresInLabel(req.expires_at)}` : 'Expired'}
    </span>
  )
}

export default function RequestsTable() {
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  async function load() {
    const res = await fetch('/api/app-requests')
    const data = await res.json()
    setRequests(data.requests ?? [])
    setLoading(false)
  }

  useEffect(() => {
    let active = true
    fetch('/api/app-requests')
      .then(r => r.json())
      .then(d => {
        if (!active) return
        setRequests(d.requests ?? [])
        setLoading(false)
      })
    return () => { active = false }
  }, [])

  async function review(id: string, action: 'approve' | 'deny' | 'revoke') {
    setBusy(id)
    setError('')
    try {
      const res = await fetch('/api/app-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
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

  async function reviewBulk(action: 'approve' | 'deny') {
    const ids = [...selected]
    if (ids.length === 0) return
    setBulkBusy(true)
    setError('')
    try {
      const res = await fetch('/api/app-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Bulk action failed')
        return
      }
      setSelected(new Set())
      await load()
    } catch {
      setError('Network error')
    } finally {
      setBulkBusy(false)
    }
  }

  if (loading) return <p className="text-gray-500 text-sm">Loading...</p>

  const allPending = requests.filter(r => r.status === 'pending')
  const q = query.trim().toLowerCase()
  const pending = q
    ? allPending.filter(r =>
        r.app_name.toLowerCase().includes(q) ||
        (r.user_email ?? '').toLowerCase().includes(q) ||
        (r.reason ?? '').toLowerCase().includes(q))
    : allPending

  const visibleIds = pending.map(r => r.id)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id))

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleAll() {
    setSelected(prev => {
      const next = new Set(prev)
      if (allVisibleSelected) visibleIds.forEach(id => next.delete(id))
      else visibleIds.forEach(id => next.add(id))
      return next
    })
  }
  const active = requests.filter(r => r.status === 'approved' && isGrantActive(r.status, r.expires_at))
  const history = requests.filter(r => r.status !== 'pending' && !active.includes(r))

  return (
    <div className="space-y-8">
      {error && <p className="text-red-400 text-sm">{error}</p>}

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-lg font-semibold text-white">
            Pending
            {allPending.length > 0 && (
              <span className="ml-2 text-xs text-yellow-500 bg-yellow-900 px-2 py-0.5 rounded-full">{allPending.length}</span>
            )}
          </h2>
          {allPending.length > 0 && (
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search app, user, or reason…"
              className="w-full sm:w-64 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>

        {allPending.length === 0 ? (
          <p className="text-gray-500 text-sm">No pending requests.</p>
        ) : pending.length === 0 ? (
          <p className="text-gray-500 text-sm">No requests match &ldquo;{query}&rdquo;.</p>
        ) : (
          <>
            {/* Select-all + bulk action bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2 px-1">
              <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-800 accent-blue-600"
                />
                {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
              </label>
              {selected.size > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => reviewBulk('approve')}
                    disabled={bulkBusy}
                    className="text-xs px-3 py-1.5 rounded-md bg-green-700 text-white hover:bg-green-600 disabled:opacity-50"
                  >
                    {bulkBusy ? 'Working…' : `Approve ${selected.size}`}
                  </button>
                  <button
                    onClick={() => reviewBulk('deny')}
                    disabled={bulkBusy}
                    className="text-xs px-3 py-1.5 rounded-md border border-red-900 text-red-400 hover:bg-red-950 disabled:opacity-50"
                  >
                    {bulkBusy ? 'Working…' : `Deny ${selected.size}`}
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {pending.map(req => (
                <div key={req.id} className={`bg-gray-900 rounded-xl border p-4 ${selected.has(req.id) ? 'border-blue-600' : 'border-gray-800'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={selected.has(req.id)}
                        onChange={() => toggle(req.id)}
                        className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-800 accent-blue-600 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-white font-medium">{req.app_name}</p>
                        <p className="text-xs text-gray-400">{req.user_email ?? 'Unknown user'} · wants {durationLabel(req.duration).toLowerCase()}</p>
                        {req.reason && <p className="text-sm text-gray-300 mt-2 italic">&ldquo;{req.reason}&rdquo;</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => review(req.id, 'approve')}
                        disabled={busy === req.id || bulkBusy}
                        className="text-xs px-3 py-1.5 rounded-md bg-green-700 text-white hover:bg-green-600 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => review(req.id, 'deny')}
                        disabled={busy === req.id || bulkBusy}
                        className="text-xs px-3 py-1.5 rounded-md border border-red-900 text-red-400 hover:bg-red-950 disabled:opacity-50"
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white mb-3">
          Active access
          {active.length > 0 && (
            <span className="ml-2 text-xs text-green-400 bg-green-950 px-2 py-0.5 rounded-full">{active.length}</span>
          )}
        </h2>
        {active.length === 0 ? (
          <p className="text-gray-500 text-sm">No active grants right now.</p>
        ) : (
          <div className="space-y-2">
            {active.map(req => (
              <div key={req.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-white font-medium">{req.app_name}</p>
                  <p className="text-xs text-gray-400">
                    {req.user_email ?? 'Unknown user'} · {req.expires_at ? expiresInLabel(req.expires_at) : 'Permanent'}
                  </p>
                </div>
                <button
                  onClick={() => review(req.id, 'revoke')}
                  disabled={busy === req.id}
                  className="text-xs px-3 py-1.5 rounded-md border border-red-900 text-red-400 hover:bg-red-950 disabled:opacity-50 whitespace-nowrap"
                >
                  {busy === req.id ? 'Revoking...' : 'Revoke access'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {history.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">History</h2>
          <DataTable
            storageId="requests-history-table"
            rows={history}
            rowKey={r => r.id}
            columns={[
              { id: 'app',       label: 'App',       defaultWidth: 180, sortValue: r => r.app_name,        filter: { type: 'text',       value: (r: Request) => r.app_name },    renderCell: r => <span className="text-white">{r.app_name}</span> },
              { id: 'user',      label: 'User',      defaultWidth: 200, sortValue: r => r.user_email ?? '', filter: { type: 'text',       value: (r: Request) => r.user_email ?? '' }, renderCell: r => <span className="text-gray-400">{r.user_email ?? '—'}</span> },
              { id: 'requested', label: 'Requested', defaultWidth: 140, sortValue: r => r.created_at,      filter: { type: 'time-range', value: (r: Request) => r.created_at },  renderCell: r => <span className="text-gray-500">{durationLabel(r.duration)}</span> },
              { id: 'status',    label: 'Status',    defaultWidth: 160, sortValue: r => r.status,          filter: { type: 'select', value: (r: Request) => r.status, options: [{ label: 'Approved', value: 'approved' }, { label: 'Denied', value: 'denied' }, { label: 'Revoked', value: 'revoked' }, { label: 'Expired', value: 'expired' }] }, renderCell: r => <StatusBadge req={r} /> },
            ] as ColDef<Request>[]}
          />
        </section>
      )}
    </div>
  )
}
