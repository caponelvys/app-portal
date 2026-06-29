'use client'

import { useState } from 'react'

export default function InviteUserPage() {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('user')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)

    const res = await fetch('/api/invite-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong')
    } else {
      setSuccess(true)
      setEmail('')
    }
  }

  const inputClass = "w-full border border-gray-700 rounded-lg px-3 py-2 text-white bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-4">
        <a href="/admin/users" className="text-gray-500 hover:text-gray-300 text-sm">← Back to Users</a>
      </header>

      <main className="max-w-lg mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <h1 className="text-2xl font-bold text-white mb-6">Invite User</h1>

        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="user@example.com"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
            <select value={role} onChange={e => setRole(e.target.value)} className={inputClass}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          {success && (
            <p className="text-green-400 text-sm">Invite sent! They'll receive an email to set up their account.</p>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
            {loading ? 'Sending...' : 'Send Invite'}
          </button>
        </form>
      </main>
    </div>
  )
}
