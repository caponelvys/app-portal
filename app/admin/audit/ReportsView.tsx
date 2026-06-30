'use client'

import { useState, useMemo } from 'react'
import AuditTable from './AuditTable'
import ExportMenu from './ExportMenu'

type AuditEvent = {
  time: string
  kind: 'request' | 'approved' | 'denied' | 'revoked' | 'accessed' | 'killed'
  app: string
  actor: string
  detail: string
}

type Org = { id: string; name: string }

type Range = 'today' | '7d' | '30d' | '90d' | 'all' | 'custom'

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d',    label: 'Last 7 days' },
  { value: '30d',   label: 'Last 30 days' },
  { value: '90d',   label: 'Last 90 days' },
  { value: 'all',   label: 'All time' },
  { value: 'custom', label: 'Custom date' },
]

function rangeStart(range: Range, customFrom: string): Date | null {
  const now = new Date()
  if (range === 'today') { const d = new Date(now); d.setHours(0, 0, 0, 0); return d }
  if (range === '7d')  return new Date(now.getTime() - 7  * 86400e3)
  if (range === '30d') return new Date(now.getTime() - 30 * 86400e3)
  if (range === '90d') return new Date(now.getTime() - 90 * 86400e3)
  if (range === 'custom' && customFrom) { const d = new Date(customFrom); d.setHours(0, 0, 0, 0); return d }
  return null
}

function rangeEnd(range: Range, customTo: string): Date | null {
  if (range === 'custom' && customTo) { const d = new Date(customTo); d.setHours(23, 59, 59, 999); return d }
  return null
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 flex flex-col gap-1">
      <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</span>
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
    </div>
  )
}

export default function ReportsView({ events, orgs, userId }: { events: AuditEvent[]; orgs: Org[]; userId?: string }) {
  const [range, setRange] = useState<Range>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo]     = useState('')

  const filtered = useMemo(() => {
    const start = rangeStart(range, customFrom)
    const end   = rangeEnd(range, customTo)
    return events.filter(e => {
      const t = new Date(e.time)
      if (start && t < start) return false
      if (end   && t > end)   return false
      return true
    })
  }, [events, range, customFrom, customTo])

  const stats = useMemo(() => ({
    total:    filtered.length,
    blocked:  filtered.filter(e => e.kind === 'killed').length,
    accessed: filtered.filter(e => e.kind === 'accessed').length,
    requests: filtered.filter(e => e.kind === 'request').length,
    approved: filtered.filter(e => e.kind === 'approved').length,
    denied:   filtered.filter(e => e.kind === 'denied').length,
  }), [filtered])

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">App activity across all users and devices.</p>
        </div>
        <ExportMenu orgs={orgs} />
      </div>

      {/* Date range selector */}
      <div className="flex flex-wrap items-center gap-2">
        {RANGE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setRange(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              range === opt.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
        {range === 'custom' && (
          <div className="flex items-center gap-2 ml-1">
            <input
              type="date"
              max={customTo || today}
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              onClick={e => (e.currentTarget as HTMLInputElement).showPicker?.()}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            />
            <span className="text-gray-500 text-sm">to</span>
            <input
              type="date"
              min={customFrom || undefined}
              max={today}
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              onClick={e => (e.currentTarget as HTMLInputElement).showPicker?.()}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            />
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Events" value={stats.total}    color="text-white" />
        <StatCard label="Blocked"      value={stats.blocked}  color="text-red-400" />
        <StatCard label="Accessed"     value={stats.accessed} color="text-blue-400" />
        <StatCard label="Requests"     value={stats.requests} color="text-yellow-400" />
        <StatCard label="Approved"     value={stats.approved} color="text-green-400" />
        <StatCard label="Denied"       value={stats.denied}   color="text-red-400" />
      </div>

      {/* Table */}
      <AuditTable events={filtered} userId={userId} />
    </div>
  )
}
