'use client'

import { useEffect, useState } from 'react'

type PendingUser = {
  id: string
  email: string
  invited_at: string
  role: string
}

type RowState = { action: 'resend' | 'cancel'; status: 'working' | 'done' | 'error'; message?: string }

export default function PendingInvites() {
  const [pending, setPending] = useState<PendingUser[]>([])
  const [loading, setLoading] = useState(true)
  const [rowState, setRowState] = useState<Record<string, RowState>>({})

  async function loadPending() {
    const res = await fetch('/api/pending-invites')
    const data = await res.json()
    setPending(data.pending ?? [])
    setLoading(false)
  }

  useEffect(() => {
    let active = true
    fetch('/api/pending-invites')
      .then(r => r.json())
      .then(d => {
        if (!active) return
        setPending(d.pending ?? [])
        setLoading(false)
      })
    return () => { active = false }
  }, [])

  function setRow(id: string, state: RowState | null) {
    setRowState(prev => {
      const next = { ...prev }
      if (state) next[id] = state
      else delete next[id]
      return next
    })
  }

  async function resend(user: PendingUser) {
    setRow(user.id, { action: 'resend', status: 'working' })
    try {
      const res = await fetch('/api/invite-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, role: user.role }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setRow(user.id, { action: 'resend', status: 'error', message: data.error ?? 'Failed to resend' })
        return
      }
      setRow(user.id, { action: 'resend', status: 'done', message: 'Invite resent' })
      await loadPending()
    } catch {
      setRow(user.id, { action: 'resend', status: 'error', message: 'Network error' })
    }
  }

  async function cancel(user: PendingUser) {
    if (!confirm(`Cancel the invite for ${user.email}? They will no longer be able to accept it.`)) return
    setRow(user.id, { action: 'cancel', status: 'working' })
    try {
      const res = await fetch('/api/pending-invites', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setRow(user.id, { action: 'cancel', status: 'error', message: data.error ?? 'Failed to cancel' })
        return
      }
      setRow(user.id, null)
      await loadPending()
    } catch {
      setRow(user.id, { action: 'cancel', status: 'error', message: 'Network error' })
    }
  }

  if (loading) return <p className="text-gray-500 text-sm">Loading...</p>
  if (pending.length === 0) return null

  return (
    <div>
      <h3 className="text-lg font-semibold text-white mb-3">
        Pending Invites
        <span className="ml-2 text-xs text-yellow-500 bg-yellow-900 px-2 py-0.5 rounded-full">{pending.length}</span>
      </h3>
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-gray-800 border-b border-gray-700">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-400">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-400">Role</th>
              <th className="text-left px-4 py-3 font-medium text-gray-400">Invited</th>
              <th className="text-left px-4 py-3 font-medium text-gray-400">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pending.map(user => {
              const state = rowState[user.id]
              const busy = state?.status === 'working'
              return (
                <tr key={user.id} className="border-b border-gray-800 hover:bg-gray-800">
                  <td className="px-4 py-3 text-white">{user.email}</td>
                  <td className="px-4 py-3 text-gray-400 capitalize">{user.role}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(user.invited_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-yellow-900 text-yellow-400">
                      Pending
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => resend(user)}
                        disabled={busy}
                        className="text-xs px-3 py-1 rounded-md border border-gray-700 text-gray-300 hover:bg-gray-700 disabled:opacity-50"
                      >
                        {state?.action === 'resend' && state.status === 'working' ? 'Sending...' : 'Resend Invite'}
                      </button>
                      <button
                        onClick={() => cancel(user)}
                        disabled={busy}
                        className="text-xs px-3 py-1 rounded-md border border-red-900 text-red-400 hover:bg-red-950 disabled:opacity-50"
                      >
                        {state?.action === 'cancel' && state.status === 'working' ? 'Cancelling...' : 'Cancel'}
                      </button>
                      {state && state.status !== 'working' && (
                        <span className={`text-xs ${state.status === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                          {state.message}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
