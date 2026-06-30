'use client'

import { useState } from 'react'

const BASE = 'https://appcontroller.vercel.app/downloads'
const AGENT_VERSION = '1.1.0'

function installCommandsFor(token: string): Record<string, string> {
  return {
    'Mac Terminal':   `curl -fsSL ${BASE}/install_mac.sh -o install_mac.sh && sudo bash install_mac.sh --token ${token}`,
    'Linux Terminal': `curl -fsSL ${BASE}/install_linux.sh -o install_linux.sh && sudo bash install_linux.sh --token ${token}`,
    'Windows CMD':    `curl -o install_win.bat ${BASE}/install_win.bat && install_win.bat ${token}`,
  }
}

const updateCommands: Record<string, string> = {
  'Mac Terminal':   `sudo curl -fsSL ${BASE}/agent.py -o /usr/local/appcontroller/agent.py && sudo launchctl kickstart -k system/com.appcontroller.agent`,
  'Linux Terminal': `sudo curl -fsSL ${BASE}/agent.py -o /usr/local/appcontroller/agent.py && sudo systemctl restart appcontroller`,
  'Windows CMD':    `curl -fsSL ${BASE}/agent.py -o "C:\\AppController\\agent.py" && schtasks /end /tn "AppControllerAgent" && schtasks /run /tn "AppControllerAgent"`,
}

type Tab = 'install' | 'update'

export default function EnrollmentPanel({ locationId, initialToken }: { locationId: string; initialToken: string | null }) {
  const [token, setToken]   = useState(initialToken ?? '')
  const [tab, setTab]       = useState<Tab>('install')
  const [os, setOs]         = useState('Mac Terminal')
  const [copied, setCopied] = useState<string | null>(null)
  const [rotating, setRotating] = useState(false)
  const [error, setError]   = useState('')

  const installCmds = installCommandsFor(token || 'NO_TOKEN')
  const commands = tab === 'install' ? installCmds : updateCommands
  const activeOs = commands[os] ? os : Object.keys(commands)[0]

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
      if (!res.ok) { setError(data.error ?? 'Failed to rotate token'); return }
      setToken(data.token)
    } catch {
      setError('Network error')
    } finally {
      setRotating(false)
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-4">
      {/* Token row */}
      <div>
        <p className="text-xs text-gray-500 mb-1">Enrollment token</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs text-green-400 font-mono break-all bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
            {token || '—'}
          </code>
          <button onClick={() => copy('token', token)}
            className="shrink-0 text-xs text-gray-400 hover:text-white border border-gray-600 rounded px-2 py-1.5 hover:border-gray-400">
            {copied === 'token' ? 'Copied!' : 'Copy'}
          </button>
          <button onClick={rotate} disabled={rotating}
            className="shrink-0 text-xs text-gray-300 border border-gray-600 rounded px-2 py-1.5 hover:bg-gray-800 disabled:opacity-50">
            {rotating ? 'Rotating...' : 'Rotate'}
          </button>
        </div>
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </div>

      {/* Tabs */}
      <div>
        <div className="flex gap-1 border-b border-gray-800 mb-3">
          {(['install', 'update'] as Tab[]).map(t => (
            <button key={t} onClick={() => { setTab(t); setCopied(null) }}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                tab === t ? 'border-blue-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}>
              {t === 'update' ? `Update to v${AGENT_VERSION}` : 'Install'}
            </button>
          ))}
        </div>

        {tab === 'update' && (
          <p className="text-xs text-gray-500 mb-2">
            Run on devices that already have the agent to update to v{AGENT_VERSION}. The agent restarts automatically.
          </p>
        )}

        <select value={activeOs} onChange={e => { setOs(e.target.value); setCopied(null) }}
          className="w-full sm:w-auto mb-2 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500">
          {Object.keys(commands).map(label => (
            <option key={label} value={label}>{label}</option>
          ))}
        </select>

        <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3">
          <code className="flex-1 text-xs text-green-400 font-mono break-all">{commands[activeOs]}</code>
          <button onClick={() => copy('cmd', commands[activeOs])}
            className="shrink-0 text-xs text-gray-400 hover:text-white border border-gray-600 rounded px-2 py-1">
            {copied === 'cmd' ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {tab === 'install' && (
          <p className="text-xs text-gray-500 mt-1">Devices installed with this command land in this location and inherit its policies.</p>
        )}
      </div>
    </div>
  )
}
