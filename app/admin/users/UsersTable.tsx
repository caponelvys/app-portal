'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import DataTable, { ColDef } from '@/app/admin/DataTable'

type Profile = {
  id: string
  email: string
  role: 'admin' | 'user'
  role_v2: string | null
  org_id: string | null
  org_name?: string | null
  created_at: string
}

const ROLE_STYLES: Record<string, string> = {
  msp_admin: 'bg-purple-900 text-purple-300', msp_tech: 'bg-blue-900 text-blue-300',
  client_admin: 'bg-green-900 text-green-300', client_user: 'bg-gray-800 text-gray-400',
  admin: 'bg-purple-900 text-purple-300', user: 'bg-gray-800 text-gray-400',
}
const ROLE_LABELS: Record<string, string> = {
  msp_admin: 'Admin', msp_tech: 'Tech', client_admin: 'Org Admin', client_user: 'Org Tech',
  admin: 'Admin', user: 'Org Tech',
}

export default function UsersTable({ users: initial, currentUserId, userId }: { users: Profile[], currentUserId: string, userId?: string }) {
  const [users, setUsers] = useState(initial)
  const [loading, setLoading] = useState<string | null>(null)
  const [mfaBusy, setMfaBusy] = useState<string | null>(null)

  async function toggleRole(user: Profile) {
    if (user.id === currentUserId) return
    setLoading(user.id)
    const newRole = user.role === 'admin' ? 'user' : 'admin'
    const newRoleV2 = newRole === 'admin' ? 'msp_admin' : 'client_user'
    const { error } = await supabase.from('profiles').update({ role: newRole, role_v2: newRoleV2 }).eq('id', user.id)
    if (!error) setUsers(users.map(u => u.id === user.id ? { ...u, role: newRole, role_v2: newRoleV2 } : u))
    setLoading(null)
  }

  async function resetMfa(user: Profile) {
    if (!confirm(`Reset 2FA for ${user.email}? They'll be signed out and must set it up again.`)) return
    setMfaBusy(user.id)
    try {
      const res = await fetch('/api/admin/reset-mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) alert(data.error ?? 'Failed to reset 2FA')
      else alert(data.removed ? '2FA reset.' : 'No 2FA was enrolled.')
    } catch {
      alert('Network error')
    } finally {
      setMfaBusy(null)
    }
  }

  const columns: ColDef<Profile>[] = [
    {
      id: 'email', label: 'Email', defaultWidth: 240, sortValue: r => r.email,
      filter: { type: 'text', value: (r: Profile) => r.email },
      renderCell: u => (
        <span className="text-white">
          {u.email}
          {u.id === currentUserId && <span className="ml-2 text-xs text-gray-500">(you)</span>}
        </span>
      ),
    },
    {
      id: 'role', label: 'Role', defaultWidth: 120, sortValue: r => r.role_v2 ?? r.role,
      filter: { type: 'select', value: (r: Profile) => ROLE_LABELS[r.role_v2 ?? r.role] ?? (r.role_v2 ?? r.role) },
      renderCell: u => {
        const r = u.role_v2 ?? u.role
        return <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${ROLE_STYLES[r] ?? 'bg-gray-800 text-gray-400'}`}>{ROLE_LABELS[r] ?? r}</span>
      },
    },
    {
      id: 'org', label: 'Org', defaultWidth: 160, sortValue: r => r.org_name ?? '',
      filter: { type: 'text', value: (r: Profile) => r.org_name ?? '' },
      renderCell: u => <span className="text-gray-400 text-xs">{u.org_name ?? '—'}</span>,
    },
    {
      id: 'joined', label: 'Joined', defaultWidth: 140, sortValue: r => r.created_at,
      filter: { type: 'time-range', value: (r: Profile) => r.created_at },
      renderCell: u => <span className="text-gray-500 text-xs">{new Date(u.created_at).toLocaleDateString()}</span>,
    },
    {
      id: 'actions', label: 'Actions', defaultWidth: 240, sortable: false,
      renderCell: u => (
        <div className="flex items-center gap-2">
          {u.id === currentUserId ? (
            <span className="text-xs text-gray-600">—</span>
          ) : (
            <button onClick={() => toggleRole(u)} disabled={loading === u.id}
              className="text-xs px-3 py-1 rounded-md border border-gray-700 text-gray-300 hover:bg-gray-700 disabled:opacity-50">
              {loading === u.id ? 'Saving...' : u.role === 'admin' ? 'Remove admin' : 'Make admin'}
            </button>
          )}
          <button onClick={() => resetMfa(u)} disabled={mfaBusy === u.id}
            className="text-xs px-3 py-1 rounded-md border border-gray-700 text-gray-400 hover:bg-gray-700 disabled:opacity-50">
            {mfaBusy === u.id ? '...' : 'Reset 2FA'}
          </button>
        </div>
      ),
    },
  ]

  return <DataTable storageId="users-table" userId={userId} columns={columns} rows={users} rowKey={r => r.id} emptyMessage="No users found." />
}
