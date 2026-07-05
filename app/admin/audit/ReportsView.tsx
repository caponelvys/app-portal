'use client'

import { useRouter } from 'next/navigation'
import { TableState, tableHref } from '@/lib/tableParams'
import AuditTableServer, { AuditEvent } from './AuditTableServer'
import ExportMenu from './ExportMenu'

type Org = { id: string; name: string }
type KindCounts = Record<string, number>

const BASE = '/admin/audit'
const RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom date' },
]

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 flex flex-col gap-1">
      <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</span>
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
    </div>
  )
}

export default function ReportsView({
  events, total, counts, state, pageSize, orgs, userId,
}: {
  events: AuditEvent[]
  total: number
  counts: KindCounts
  state: TableState
  pageSize: number
  orgs: Org[]
  userId?: string
}) {
  const router = useRouter()
  const range = state.filters.range ?? '30d'
  const customFrom = state.filters.from ?? ''
  const customTo = state.filters.to ?? ''
  const go = (href: string) => router.replace(href, { scroll: false })

  const setRange = (value: string) =>
    go(tableHref(BASE, state, { filters: { range: value, ...(value === 'custom' ? {} : { from: null, to: null }) } }))
  const setCustom = (which: 'from' | 'to', value: string) =>
    go(tableHref(BASE, state, { filters: { range: 'custom', [which]: value || null } }))

  const stats = {
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    blocked: counts.killed ?? 0,
    accessed: counts.accessed ?? 0,
    requests: counts.request ?? 0,
    approved: counts.approved ?? 0,
    denied: counts.denied ?? 0,
  }
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-6">
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
          <button key={opt.value} onClick={() => setRange(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              range === opt.value ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
            {opt.label}
          </button>
        ))}
        {range === 'custom' && (
          <div className="flex items-center gap-2 ml-1">
            <input type="date" max={customTo || today} value={customFrom}
              onChange={e => setCustom('from', e.target.value)}
              onClick={e => (e.currentTarget as HTMLInputElement).showPicker?.()}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer" />
            <span className="text-gray-500 text-sm">to</span>
            <input type="date" min={customFrom || undefined} max={today} value={customTo}
              onChange={e => setCustom('to', e.target.value)}
              onClick={e => (e.currentTarget as HTMLInputElement).showPicker?.()}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer" />
          </div>
        )}
      </div>

      {/* Stat cards (aggregates over the whole filtered range) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Events" value={stats.total} color="text-white" />
        <StatCard label="Blocked" value={stats.blocked} color="text-red-400" />
        <StatCard label="Accessed" value={stats.accessed} color="text-[#60a5fa]" />
        <StatCard label="Requests" value={stats.requests} color="text-yellow-400" />
        <StatCard label="Approved" value={stats.approved} color="text-green-400" />
        <StatCard label="Denied" value={stats.denied} color="text-red-400" />
      </div>

      <AuditTableServer events={events} total={total} state={state} pageSize={pageSize} userId={userId} />
    </div>
  )
}
