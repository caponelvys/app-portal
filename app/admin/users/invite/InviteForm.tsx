'use client'

import { useState } from 'react'

type Org = { id: string; name: string }

const ROLES = [
  { value: 'msp_admin',    label: 'Admin — full access to all orgs' },
  { value: 'msp_tech',     label: 'Tech — access to assigned orgs only' },
  { value: 'client_admin', label: 'Org Admin — manage own org' },
  { value: 'client_user',  label: 'Org Tech — view own org, request access' },
]

const CLIENT_ROLES = ['client_admin', 'client_user']

export default function InviteForm({ orgs }: { orgs: Org[] }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('client_user')
  const [orgId, setOrgId] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const needsOrg = CLIENT_ROLES.includes(role)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)

    const body: Record<string, string> = { email, role }
    if (needsOrg && orgId) body.org_id = orgId

    const res = await fetch('/api/invite-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
          {ROLES.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      {needsOrg && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Organization</label>
          <select value={orgId} onChange={e => setOrgId(e.target.value)} className={inputClass}>
            <option value="">— select org —</option>
            {orgs.map(o => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {success && (
        <p className="text-green-400 text-sm">Invite sent! They'll receive an email to set up their account.</p>
      )}

      <button type="submit" disabled={loading}
        className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
        {loading ? 'Sending...' : 'Send Invite'}
      </button>
    </form>
  )
}
