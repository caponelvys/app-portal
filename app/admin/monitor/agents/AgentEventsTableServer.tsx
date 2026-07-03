'use client'

import { useRouter } from 'next/navigation'
import ServerDataTable, { ServerColDef } from '@/app/admin/ServerDataTable'
import { TableState, tableHref } from '@/lib/tableParams'
import { AGENT_EVENT_LABEL, agentEventLabel, LEVEL_DOT } from '@/lib/agentEvents'

type Ev = { id: string; device_id: string; level: string; event: string; message: string | null; created_at: string }

const BASE = '/admin/monitor/agents'
const LEVEL_OPTIONS = [
  { label: 'Info', value: 'info' },
  { label: 'Warning', value: 'warn' },
  { label: 'Error', value: 'error' },
]
const EVENT_OPTIONS = Object.entries(AGENT_EVENT_LABEL).map(([value, label]) => ({ label, value }))

export default function AgentEventsTableServer({
  events, total, state, pageSize, hostnameById, userId,
}: {
  events: Ev[]
  total: number
  state: TableState
  pageSize: number
  hostnameById: Record<string, string>
  userId?: string
}) {
  const router = useRouter()
  const errorsOnly = state.filters.level === 'error'
  const setLevel = (v: string | null) => router.replace(tableHref(BASE, state, { filters: { level: v } }), { scroll: false })

  const columns: ServerColDef<Ev>[] = [
    {
      id: 'device', label: 'Device', defaultWidth: 180, sortable: false,
      filter: { type: 'text', placeholder: 'Search device…' },
      renderCell: r => <span className="text-gray-300 text-sm">{hostnameById[r.device_id] ?? r.device_id.slice(0, 8) + '…'}</span>,
    },
    {
      id: 'level', label: 'Level', defaultWidth: 110,
      filter: { type: 'select', options: LEVEL_OPTIONS },
      renderCell: r => (
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-300 capitalize">
          <span className={`w-2 h-2 rounded-full ${LEVEL_DOT[r.level] ?? 'bg-gray-500'}`} />
          {r.level}
        </span>
      ),
    },
    {
      id: 'event', label: 'Event', defaultWidth: 170,
      filter: { type: 'select', options: EVENT_OPTIONS },
      renderCell: r => <span className="text-white text-sm">{agentEventLabel(r.event)}</span>,
    },
    {
      id: 'message', label: 'Message', defaultWidth: 300,
      filter: { type: 'text', placeholder: 'Search message…' },
      renderCell: r => <span className="text-gray-400 text-xs">{r.message ?? '—'}</span>,
    },
    {
      id: 'time', label: 'Time', defaultWidth: 180,
      filter: { type: 'time-range' },
      renderCell: r => <span className="text-gray-500 text-xs">{new Date(r.created_at).toLocaleString()}</span>,
    },
  ]

  return (
    <div>
      <div className="flex gap-1 mb-2">
        <button onClick={() => setLevel(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${!errorsOnly ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
          All events
        </button>
        <button onClick={() => setLevel('error')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${errorsOnly ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
          Errors only
        </button>
      </div>
      <ServerDataTable
        storageId="agent-events"
        userId={userId}
        basePath={BASE}
        state={state}
        columns={columns}
        rows={events}
        total={total}
        pageSize={pageSize}
        rowKey={r => r.id}
        emptyMessage="No agent events recorded yet."
      />
    </div>
  )
}
