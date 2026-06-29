'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  email: string
  role: 'admin' | 'user'
  created_at: string
}

export default function UsersTable({ users: initial, currentUserId }: { users: Profile[], currentUserId: string }) {
  const [users, setUsers] = useState(initial)
  const [loading, setLoading] = useState<string | null>(null)

  async function toggleRole(user: Profile) {
    if (user.id === currentUserId) return // can't demote yourself
    setLoading(user.id)
    const newRole = user.role === 'admin' ? 'user' : 'admin'

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', user.id)

    if (!error) {
      setUsers(users.map(u => u.id === user.id ? { ...u, role: newRole } : u))
    }
    setLoading(null)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Joined</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-800">
                {user.email}
                {user.id === currentUserId && (
                  <span className="ml-2 text-xs text-gray-400">(you)</span>
                )}
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  user.role === 'admin'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {user.role}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-400 text-xs">
                {new Date(user.created_at).toLocaleDateString()}
              </td>
              <td className="px-4 py-3">
                {user.id === currentUserId ? (
                  <span className="text-xs text-gray-300">—</span>
                ) : (
                  <button
                    onClick={() => toggleRole(user)}
                    disabled={loading === user.id}
                    className="text-xs px-3 py-1 rounded-md border border-gray-200 hover:bg-gray-100 disabled:opacity-50"
                  >
                    {loading === user.id
                      ? 'Saving...'
                      : user.role === 'admin' ? 'Remove admin' : 'Make admin'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {users.length === 0 && (
        <p className="text-center text-gray-400 py-10">No users found.</p>
      )}
    </div>
  )
}
