'use client'

import { useEffect, useState } from 'react'
import { durationLabel, isGrantActive, expiresInLabel } from '@/lib/durations'

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

  if (loading) return <p className="text-gray-500 text-sm">Loading...</p>

  const pending = requests.filter(r => r.status === 'pending')
  const active = requests.filter(r => r.status === 'approved' && isGrantActive(r.status, r.expires_at))
  const history = requests.filter(r => r.status !== 'pending' && !active.includes(r))

  return (
    <div className="space-y-8">
      {error && <p className="text-red-400 text-sm">{error}</p>}

      <section>
        <h2 className="text-lg font-semibold text-white mb-3">
          Pending
          {pending.length > 0 && (
            <span className="ml-2 text-xs text-yellow-500 bg-yellow-900 px-2 py-0.5 rounded-full">{pending.length}</span>
          )}
        </h2>
        {pending.length === 0 ? (
          <p className="text-gray-500 text-sm">No pending requests.</p>
        ) : (
          <div className="space-y-2">
            {pending.map(req => (
              <div key={req.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white font-medium">{req.app_name}</p>
                    <p className="text-xs text-gray-400">{req.user_email ?? 'Unknown user'} · wants {durationLabel(req.duration).toLowerCase()}</p>
                    {req.reason && <p className="text-sm text-gray-300 mt-2 italic">&ldquo;{req.reason}&rdquo;</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => review(req.id, 'approve')}
                      disabled={busy === req.id}
                      className="text-xs px-3 py-1.5 rounded-md bg-green-700 text-white hover:bg-green-600 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => review(req.id, 'deny')}
                      disabled={busy === req.id}
                      className="text-xs px-3 py-1.5 rounded-md border border-red-900 text-red-400 hover:bg-red-950 disabled:opacity-50"
                    >
                      Deny
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-gray-800 border-b border-gray-700">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-400">App</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-400">User</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-400">Requested</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map(req => (
                  <tr key={req.id} className="border-b border-gray-800">
                    <td className="px-4 py-3 text-white">{req.app_name}</td>
                    <td className="px-4 py-3 text-gray-400">{req.user_email ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{durationLabel(req.duration)}</td>
                    <td className="px-4 py-3"><StatusBadge req={req} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
