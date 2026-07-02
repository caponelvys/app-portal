'use client'

import DataTable, { ColDef } from '@/app/admin/DataTable'
import { agentEventLabel, LEVEL_DOT } from '@/lib/agentEvents'

type Ev = { id: string; device_id: string; level: string; event: string; message: string | null; created_at: string }

const LEVEL_OPTIONS = [
  { label: 'Info',    value: 'info' },
  { label: 'Warning', value: 'warn' },
  { label: 'Error',   value: 'error' },
]

export default function AgentEventsTable({ events, hostnameById, userId }: { events: Ev[]; hostnameById: Record<string, string>; userId?: string }) {
  const columns: ColDef<Ev>[] = [
    {
      id: 'device', label: 'Device', defaultWidth: 180, sortValue: r => hostnameById[r.device_id] ?? r.device_id,
      filter: { type: 'text', value: (r: Ev) => hostnameById[r.device_id] ?? r.device_id },
      renderCell: r => <span className="text-gray-300 text-sm">{hostnameById[r.device_id] ?? r.device_id.slice(0, 8) + '…'}</span>,
    },
    {
      id: 'level', label: 'Level', defaultWidth: 110, sortValue: r => r.level,
      filter: { type: 'select', value: (r: Ev) => r.level, options: LEVEL_OPTIONS },
      renderCell: r => (
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-300 capitalize">
          <span className={`w-2 h-2 rounded-full ${LEVEL_DOT[r.level] ?? 'bg-gray-500'}`} />
          {r.level}
        </span>
      ),
    },
    {
      id: 'event', label: 'Event', defaultWidth: 170, sortValue: r => agentEventLabel(r.event),
      filter: { type: 'select', value: (r: Ev) => agentEventLabel(r.event) },
      renderCell: r => <span className="text-white text-sm">{agentEventLabel(r.event)}</span>,
    },
    {
      id: 'message', label: 'Message', defaultWidth: 300, sortValue: r => r.message ?? '',
      filter: { type: 'text', value: (r: Ev) => r.message ?? '' },
      renderCell: r => <span className="text-gray-400 text-xs">{r.message ?? '—'}</span>,
    },
    {
      id: 'time', label: 'Time', defaultWidth: 180, sortValue: r => r.created_at,
      filter: { type: 'time-range', value: (r: Ev) => r.created_at },
      renderCell: r => <span className="text-gray-500 text-xs">{new Date(r.created_at).toLocaleString()}</span>,
    },
  ]

  return (
    <DataTable
      storageId="agent-events-table"
      columns={columns}
      rows={events}
      rowKey={r => r.id}
      userId={userId}
      emptyMessage="No agent events recorded yet."
    />
  )
}
