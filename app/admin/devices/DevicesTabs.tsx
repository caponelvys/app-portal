'use client'

import { useState, useMemo, useRef, useEffect } from 'react'

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
  { label: 'Any time',       value: 'any' },
  { label: 'Last 5 minutes', value: '5m' },
  { label: 'Last hour',      value: '1h' },
  { label: 'Last 24 hours',  value: '24h' },
  { label: 'Last 7 days',    value: '7d' },
]

function lastSeenCutoff(value: string): number | null {
  const map: Record<string, number> = { '5m': 5*60e3, '1h': 3600e3, '24h': 86400e3, '7d': 604800e3 }
  return map[value] ?? null
}

function FilterIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-3.5 h-3.5 ${active ? 'text-blue-400' : 'text-gray-600 group-hover:text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-.293.707L13 9.414V15a1 1 0 01-.553.894l-4 2A1 1 0 017 17v-7.586L3.293 5.707A1 1 0 013 5V3z" clipRule="evenodd" />
    </svg>
  )
}

function ColumnFilter({ children, onClear, active }: { children: React.ReactNode; onClear: () => void; active: boolean }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        popRef.current && !popRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left })
    }
    setOpen(o => !o)
  }

  return (
    <span className="inline-block">
      <button
        ref={btnRef}
        onClick={toggle}
        className="group ml-1.5 p-0.5 rounded hover:bg-gray-700 transition-colors align-middle"
      >
        <FilterIcon active={active} />
      </button>
      {open && (
        <div
          ref={popRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-3 min-w-[180px]"
        >
          {children}
          {active && (
            <button
              onClick={() => { onClear(); setOpen(false) }}
              className="mt-2 w-full text-xs text-gray-400 hover:text-white text-left"
            >
              Clear filter
            </button>
          )}
        </div>
      )}
    </span>
  )
}

export default function DevicesTabs({ devices }: { devices: Device[] }) {
  const [hostnameFilter, setHostnameFilter] = useState('')
  const [osFilter, setOsFilter]             = useState('all')
  const [statusFilter, setStatusFilter]     = useState('all')
  const [lastSeenFilter, setLastSeenFilter] = useState('any')

  const osOptions = useMemo(() => {
    const seen = new Set(devices.map(d => osLabel(d.os)))
    return Array.from(seen).sort()
  }, [devices])

  const filtered = useMemo(() => {
    const cutoff = lastSeenCutoff(lastSeenFilter)
    const now = Date.now()
    return devices.filter(d => {
      if (hostnameFilter && !d.hostname.toLowerCase().includes(hostnameFilter.toLowerCase())) return false
      if (osFilter !== 'all' && osLabel(d.os) !== osFilter) return false
      const online = isOnline(d.last_seen)
      if (statusFilter === 'online' && !online) return false
      if (statusFilter === 'offline' && online) return false
      if (cutoff && now - new Date(d.last_seen).getTime() > cutoff) return false
      return true
    })
  }, [devices, hostnameFilter, osFilter, statusFilter, lastSeenFilter])

  const inputClass = "w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
  const selectClass = "w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"

  return (
    <div className="space-y-3">
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead className="bg-gray-800 border-b border-gray-700">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-400 whitespace-nowrap">
                Hostname
                <ColumnFilter active={!!hostnameFilter} onClear={() => setHostnameFilter('')}>
                  <input
                    autoFocus
                    type="text"
                    placeholder="Search hostname..."
                    value={hostnameFilter}
                    onChange={e => setHostnameFilter(e.target.value)}
                    className={inputClass}
                  />
                </ColumnFilter>
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-400 whitespace-nowrap">
                OS
                <ColumnFilter active={osFilter !== 'all'} onClear={() => setOsFilter('all')}>
                  <select value={osFilter} onChange={e => setOsFilter(e.target.value)} className={selectClass}>
                    <option value="all">All OS</option>
                    {osOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </ColumnFilter>
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-400 whitespace-nowrap">
                Status
                <ColumnFilter active={statusFilter !== 'all'} onClear={() => setStatusFilter('all')}>
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectClass}>
                    <option value="all">All</option>
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                  </select>
                </ColumnFilter>
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-400 whitespace-nowrap">
                Last Seen
                <ColumnFilter active={lastSeenFilter !== 'any'} onClear={() => setLastSeenFilter('any')}>
                  <select value={lastSeenFilter} onChange={e => setLastSeenFilter(e.target.value)} className={selectClass}>
                    {LAST_SEEN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </ColumnFilter>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(device => (
              <tr key={device.id} className="border-b border-gray-800 hover:bg-gray-800">
                <td className="px-4 py-3 font-medium text-white">
                  <a href={`/admin/devices/${device.device_id}`} className="hover:text-blue-400 transition-colors">
                    {device.hostname.split('.')[0]}
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
                    : 'No devices match the active filters.'}
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
