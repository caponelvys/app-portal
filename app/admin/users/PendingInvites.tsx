'use client'

import { useEffect, useState } from 'react'

type PendingUser = {
  id: string
  email: string
  invited_at: string
}

export default function PendingInvites() {
  const [pending, setPending] = useState<PendingUser[]>([])
  const [loading, setLoading] = useState(true)
  const [resending, setResending] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/pending-invites')
      .then(r => r.json())
      .then(d => { setPending(d.pending ?? []); setLoading(false) })
  }, [])

  async function resend(email: string) {
    setResending(email)
    await fetch('/api/invite-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setResending(null)
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
        <table className="w-full text-sm min-w-[500px]">
          <thead className="bg-gray-800 border-b border-gray-700">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-400">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-400">Invited</th>
              <th className="text-left px-4 py-3 font-medium text-gray-400">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pending.map(user => (
              <tr key={user.id} className="border-b border-gray-800 hover:bg-gray-800">
                <td className="px-4 py-3 text-white">{user.email}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(user.invited_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-yellow-900 text-yellow-400">
                    Pending
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => resend(user.email!)}
                    disabled={resending === user.email}
                    className="text-xs px-3 py-1 rounded-md border border-gray-700 text-gray-300 hover:bg-gray-700 disabled:opacity-50"
                  >
                    {resending === user.email ? 'Sending...' : 'Resend Invite'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
