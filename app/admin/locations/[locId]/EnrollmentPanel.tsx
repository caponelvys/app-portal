'use client'

import { useState } from 'react'

const BASE = 'https://appcontroller.vercel.app/downloads'

function commandsFor(token: string): Record<string, string> {
  return {
    'Mac Terminal': `curl -fsSL ${BASE}/install_mac.sh -o install_mac.sh && sudo bash install_mac.sh --token ${token}`,
    'Linux Terminal': `curl -fsSL ${BASE}/install_linux.sh -o install_linux.sh && sudo bash install_linux.sh --token ${token}`,
    'Windows CMD': `curl -o install_win.bat ${BASE}/install_win.bat && install_win.bat ${token}`,
  }
}

export default function EnrollmentPanel({ locationId, initialToken }: { locationId: string; initialToken: string | null }) {
  const [token, setToken] = useState(initialToken ?? '')
  const [os, setOs] = useState('Mac Terminal')
  const [copied, setCopied] = useState<string | null>(null)
  const [rotating, setRotating] = useState(false)
  const [error, setError] = useState('')

  const commands = commandsFor(token || 'NO_TOKEN')

  function copy(key: string, value: string) {
    navigator.clipboard.writeText(value)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  async function rotate() {
    if (!confirm('Rotate this token? Existing install commands will stop enrolling new devices.')) return
    setRotating(true)
    setError('')
    try {
      const res = await fetch('/api/enrollment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Failed to rotate token')
        return
      }
      setToken(data.token)
    } catch {
      setError('Network error')
    } finally {
      setRotating(false)
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-4">
      <div>
        <p className="text-xs text-gray-500 mb-1">Enrollment token</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs text-green-400 font-mono break-all bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
            {token || '—'}
          </code>
          <button
            onClick={() => copy('token', token)}
            className="shrink-0 text-xs text-gray-400 hover:text-white border border-gray-600 rounded px-2 py-1.5 hover:border-gray-400"
          >
            {copied === 'token' ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={rotate}
            disabled={rotating}
            className="shrink-0 text-xs text-gray-300 border border-gray-600 rounded px-2 py-1.5 hover:bg-gray-800 disabled:opacity-50"
          >
            {rotating ? 'Rotating...' : 'Rotate'}
          </button>
        </div>
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </div>

      <div>
        <p className="text-xs text-gray-500 mb-1">Install command</p>
        <select
          value={os}
          onChange={e => { setOs(e.target.value); setCopied(null) }}
          className="w-full sm:w-auto mb-2 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {Object.keys(commands).map(label => (
            <option key={label} value={label}>{label}</option>
          ))}
        </select>
        <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3">
          <code className="flex-1 text-xs text-green-400 font-mono break-all">{commands[os]}</code>
          <button
            onClick={() => copy('cmd', commands[os])}
            className="shrink-0 text-xs text-gray-400 hover:text-white border border-gray-600 rounded px-2 py-1"
          >
            {copied === 'cmd' ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">Devices installed with this command land in this location and inherit its policies.</p>
      </div>
    </div>
  )
}
