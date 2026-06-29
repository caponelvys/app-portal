'use client'

import { useState } from 'react'
import { getAppLogoUrl } from '@/lib/appLogos'
import { DURATIONS } from '@/lib/durations'

export type RequestableApp = {
  id: string
  name: string
  description: string
  icon_url: string | null
  requestStatus: 'none' | 'pending' | 'denied'
}

function AppLogo({ name, iconUrl }: { name: string; iconUrl: string | null }) {
  const url = getAppLogoUrl(name, iconUrl)
  if (url) return <img src={url} alt={name} className="w-10 h-10 rounded-lg object-contain bg-white p-1" />
  return (
    <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-lg font-bold text-gray-400 border border-gray-700">
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function RequestCard({ app }: { app: RequestableApp }) {
  const [open, setOpen] = useState(false)
  const [duration, setDuration] = useState<string>('4h')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<RequestableApp['requestStatus']>(app.requestStatus)
  const [error, setError] = useState('')

  async function submit() {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/app-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: app.id, duration, reason }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Failed to submit request')
        return
      }
      setStatus('pending')
      setOpen(false)
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <AppLogo name={app.name} iconUrl={app.icon_url} />
        <div className="min-w-0">
          <p className="font-semibold text-white truncate">{app.name}</p>
          {app.description && <p className="text-xs text-gray-400 truncate">{app.description}</p>}
        </div>
      </div>

      {status === 'pending' ? (
        <span className="inline-flex w-fit items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-900 text-yellow-400">
          Request pending
        </span>
      ) : open ? (
        <div className="space-y-2">
          <label className="block text-xs text-gray-400">For how long?</label>
          <select
            value={duration}
            onChange={e => setDuration(e.target.value)}
            className="w-full border border-gray-700 rounded-lg px-3 py-2 text-sm text-white bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {DURATIONS.map(d => (
              <option key={d.code} value={d.code}>{d.label}</option>
            ))}
          </select>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={2}
            placeholder="Reason (optional)"
            className="w-full border border-gray-700 rounded-lg px-3 py-2 text-sm text-white bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={submitting}
              className="flex-1 bg-blue-600 text-white text-sm py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {submitting ? 'Sending...' : 'Send request'}
            </button>
            <button
              onClick={() => setOpen(false)}
              disabled={submitting}
              className="px-3 text-sm text-gray-400 hover:text-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOpen(true)}
            className="text-xs px-3 py-1.5 rounded-md border border-gray-700 text-gray-200 hover:bg-gray-800"
          >
            Request access
          </button>
          {status === 'denied' && <span className="text-xs text-red-400">Previously denied</span>}
        </div>
      )}
    </div>
  )
}

export default function RequestAccess({ apps }: { apps: RequestableApp[] }) {
  if (apps.length === 0) return null
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-white mb-1">Request access</h2>
      <p className="text-sm text-gray-500 mb-4">
        These apps are currently blocked. Request temporary or permanent access and an admin will review it.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {apps.map(app => (
          <RequestCard key={app.id} app={app} />
        ))}
      </div>
    </section>
  )
}
