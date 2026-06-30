'use client'

import { useState, useMemo } from 'react'

type Device = {
  id: string
  device_id: string
  hostname: string
  os: string
  last_seen: string
}

function osLabel(os: string) {
  if (os === 'Darwin') return 'macOS'
  if (os === 'Windows') return 'Windows'
  return os
}

function isOnline(lastSeen: string) {
  return Date.now() - new Date(lastSeen).getTime() < 2 * 60 * 1000
}

const LAST_SEEN_OPTIONS = [
  { label: 'Any time', value: 'any' },
  { label: 'Last 5 minutes', value: '5m' },
  { label: 'Last hour', value: '1h' },
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 7 days', value: '7d' },
]

function lastSeenMs(value: string): number | null {
  switch (value) {
    case '5m':  return 5 * 60 * 1000
    case '1h':  return 60 * 60 * 1000
    case '24h': return 24 * 60 * 60 * 1000
    case '7d':  return 7 * 24 * 60 * 60 * 1000
    default:    return null
  }
}

export default function DevicesTabs({ devices }: { devices: Device[] }) {
  const [search, setSearch]       = useState('')
  const [osFilter, setOsFilter]   = useState('all')
  const [status, setStatus]       = useState('all')
  const [lastSeen, setLastSeen]   = useState('any')

  const osOptions = useMemo(() => {
    const seen = new Set(devices.map(d => osLabel(d.os)))
    return ['all', ...Array.from(seen).sort()]
  }, [devices])

  const filtered = useMemo(() => {
    const threshold = lastSeenMs(lastSeen)
    const now = Date.now()
    return devices.filter(d => {
      if (search && !d.hostname.toLowerCase().includes(search.toLowerCase())) return false
      if (osFilter !== 'all' && osLabel(d.os) !== osFilter) return false
      const online = isOnline(d.last_seen)
      if (status === 'online' && !online) return false
      if (status === 'offline' && online) return false
      if (threshold && now - new Date(d.last_seen).getTime() > threshold) return false
      return true
    })
  }, [devices, search, osFilter, status, lastSeen])

  const selectClass = "border border-gray-700 rounded-lg px-3 py-2 text-sm text-white bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search hostname..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-700 rounded-lg px-3 py-2 text-sm text-white bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
        />
        <select value={osFilter} onChange={e => setOsFilter(e.target.value)} className={selectClass}>
          <option value="all">All OS</option>
          {osOptions.filter(o => o !== 'all').map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className={selectClass}>
          <option value="all">All Status</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
        </select>
        <select value={lastSeen} onChange={e => setLastSeen(e.target.value)} className={selectClass}>
          {LAST_SEEN_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {(search || osFilter !== 'all' || status !== 'all' || lastSeen !== 'any') && (
          <button
            onClick={() => { setSearch(''); setOsFilter('all'); setStatus('all'); setLastSeen('any') }}
            className="text-sm text-gray-400 hover:text-white px-3 py-2 border border-gray-700 rounded-lg hover:border-gray-500 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead className="bg-gray-800 border-b border-gray-700">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-400">Hostname</th>
              <th className="text-left px-4 py-3 font-medium text-gray-400">OS</th>
              <th className="text-left px-4 py-3 font-medium text-gray-400">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-400">Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(device => (
              <tr key={device.id} className="border-b border-gray-800 hover:bg-gray-800">
                <td className="px-4 py-3 font-medium text-white">
                  <a href={`/admin/devices/${device.device_id}`} className="hover:text-blue-400 transition-colors">
                    {device.hostname}
                  </a>
                </td>
                <td className="px-4 py-3 text-gray-400">{osLabel(device.os)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                    isOnline(device.last_seen) ? 'bg-green-900 text-green-400' : 'bg-gray-800 text-gray-500'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isOnline(device.last_seen) ? 'bg-green-400' : 'bg-gray-500'}`} />
                    {isOnline(device.last_seen) ? 'Online' : 'Offline'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(device.last_seen).toLocaleString()}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                  {devices.length === 0
                    ? 'No devices enrolled yet. Select an organization and use Install Agent to get started.'
                    : 'No devices match your filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-600">{filtered.length} of {devices.length} device{devices.length !== 1 ? 's' : ''}</p>
    </div>
  )
}
