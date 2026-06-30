'use client'

import { useEffect, useState } from 'react'
import DataTable, { ColDef } from '@/app/admin/DataTable'

type PendingUser = { id: string; email: string; invited_at: string; role: string }
type RowState = { action: 'resend' | 'cancel'; status: 'working' | 'done' | 'error'; message?: string }

export default function PendingInvites({ userId }: { userId?: string }) {
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
    fetch('/api/pending-invites').then(r => r.json()).then(d => {
      if (!active) return
      setPending(d.pending ?? [])
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  function setRow(id: string, state: RowState | null) {
    setRowState(prev => { const n = { ...prev }; if (state) n[id] = state; else delete n[id]; return n })
  }

  async function resend(user: PendingUser) {
    setRow(user.id, { action: 'resend', status: 'working' })
    try {
      const res = await fetch('/api/invite-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email, role: user.role }) })
      if (!res.ok) { const d = await res.json().catch(() => ({})); setRow(user.id, { action: 'resend', status: 'error', message: d.error ?? 'Failed' }); return }
      setRow(user.id, { action: 'resend', status: 'done', message: 'Invite resent' })
      await loadPending()
    } catch { setRow(user.id, { action: 'resend', status: 'error', message: 'Network error' }) }
  }

  async function cancel(user: PendingUser) {
    if (!confirm(`Cancel the invite for ${user.email}?`)) return
    setRow(user.id, { action: 'cancel', status: 'working' })
    try {
      const res = await fetch('/api/pending-invites', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: user.id }) })
      if (!res.ok) { const d = await res.json().catch(() => ({})); setRow(user.id, { action: 'cancel', status: 'error', message: d.error ?? 'Failed' }); return }
      setRow(user.id, null)
      await loadPending()
    } catch { setRow(user.id, { action: 'cancel', status: 'error', message: 'Network error' }) }
  }

  if (loading) return <p className="text-gray-500 text-sm">Loading...</p>
  if (pending.length === 0) return null

  const columns: ColDef<PendingUser>[] = [
    { id: 'email',   label: 'Email',   defaultWidth: 240, sortValue: r => r.email,      renderCell: u => <span className="text-white">{u.email}</span> },
    { id: 'role',    label: 'Role',    defaultWidth: 120, sortValue: r => r.role,        renderCell: u => <span className="text-gray-400 capitalize">{u.role}</span> },
    { id: 'invited', label: 'Invited', defaultWidth: 140, sortValue: r => r.invited_at,  renderCell: u => <span className="text-gray-500 text-xs">{new Date(u.invited_at).toLocaleDateString()}</span> },
    { id: 'status',  label: 'Status',  defaultWidth: 110, sortable: false,               renderCell: () => <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-yellow-900 text-yellow-400">Pending</span> },
    {
      id: 'actions', label: 'Actions', defaultWidth: 240, sortable: false,
      renderCell: u => {
        const state = rowState[u.id]
        const busy = state?.status === 'working'
        return (
          <div className="flex items-center gap-2">
            <button onClick={() => resend(u)} disabled={busy} className="text-xs px-3 py-1 rounded-md border border-gray-700 text-gray-300 hover:bg-gray-700 disabled:opacity-50">
              {state?.action === 'resend' && busy ? 'Sending...' : 'Resend Invite'}
            </button>
            <button onClick={() => cancel(u)} disabled={busy} className="text-xs px-3 py-1 rounded-md border border-red-900 text-red-400 hover:bg-red-950 disabled:opacity-50">
              {state?.action === 'cancel' && busy ? 'Cancelling...' : 'Cancel'}
            </button>
            {state && state.status !== 'working' && (
              <span className={`text-xs ${state.status === 'error' ? 'text-red-400' : 'text-green-400'}`}>{state.message}</span>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div>
      <h3 className="text-lg font-semibold text-white mb-3">
        Pending Invites
        <span className="ml-2 text-xs text-yellow-500 bg-yellow-900 px-2 py-0.5 rounded-full">{pending.length}</span>
      </h3>
      <DataTable storageId="pending-invites-table" userId={userId} columns={columns} rows={pending} rowKey={r => r.id} />
    </div>
  )
}
