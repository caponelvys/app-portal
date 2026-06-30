'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

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
  msp_admin:    'bg-purple-900 text-purple-300',
  msp_tech:     'bg-blue-900 text-blue-300',
  client_admin: 'bg-green-900 text-green-300',
  client_user:  'bg-gray-800 text-gray-400',
  admin:        'bg-purple-900 text-purple-300',
  user:         'bg-gray-800 text-gray-400',
}

export default function UsersTable({ users: initial, currentUserId }: { users: Profile[], currentUserId: string }) {
  const [users, setUsers] = useState(initial)
  const [loading, setLoading] = useState<string | null>(null)

  async function toggleRole(user: Profile) {
    if (user.id === currentUserId) return
    setLoading(user.id)
    const newRole = user.role === 'admin' ? 'user' : 'admin'
    const newRoleV2 = newRole === 'admin' ? 'msp_admin' : 'client_user'

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole, role_v2: newRoleV2 })
      .eq('id', user.id)

    if (!error) {
      setUsers(users.map(u => u.id === user.id ? { ...u, role: newRole, role_v2: newRoleV2 } : u))
    }
    setLoading(null)
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden overflow-x-auto">
      <table className="w-full text-sm min-w-[560px]">
        <thead className="bg-gray-800 border-b border-gray-700">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-400">Email</th>
            <th className="text-left px-4 py-3 font-medium text-gray-400">Role</th>
            <th className="text-left px-4 py-3 font-medium text-gray-400">Org</th>
            <th className="text-left px-4 py-3 font-medium text-gray-400">Joined</th>
            <th className="text-left px-4 py-3 font-medium text-gray-400">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => {
            const displayRole = user.role_v2 ?? user.role
            return (
              <tr key={user.id} className="border-b border-gray-800 hover:bg-gray-800">
                <td className="px-4 py-3 text-white">
                  {user.email}
                  {user.id === currentUserId && (
                    <span className="ml-2 text-xs text-gray-500">(you)</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${ROLE_STYLES[displayRole] ?? 'bg-gray-800 text-gray-400'}`}>
                    {displayRole}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {user.org_name ?? '—'}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  {user.id === currentUserId ? (
                    <span className="text-xs text-gray-600">—</span>
                  ) : (
                    <button
                      onClick={() => toggleRole(user)}
                      disabled={loading === user.id}
                      className="text-xs px-3 py-1 rounded-md border border-gray-700 text-gray-300 hover:bg-gray-700 disabled:opacity-50"
                    >
                      {loading === user.id ? 'Saving...' : user.role === 'admin' ? 'Remove admin' : 'Make admin'}
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {users.length === 0 && (
        <p className="text-center text-gray-500 py-10">No users found.</p>
      )}
    </div>
  )
}
