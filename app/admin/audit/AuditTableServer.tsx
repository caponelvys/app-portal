'use client'

import ServerDataTable, { ServerColDef } from '@/app/admin/ServerDataTable'
import { TableState } from '@/lib/tableParams'

export type AuditEvent = {
  time: string
  kind: 'request' | 'approved' | 'denied' | 'revoked' | 'accessed' | 'killed'
  app: string
  actor: string
  detail: string
}

const KIND_STYLES: Record<AuditEvent['kind'], string> = {
  request: 'bg-yellow-900 text-yellow-400', approved: 'bg-green-950 text-green-400',
  denied: 'bg-red-950 text-red-400', revoked: 'bg-red-950 text-red-400',
  accessed: 'bg-[#172554] text-[#93c5fd]', killed: 'bg-gray-800 text-gray-400',
}
const KIND_LABELS: Record<AuditEvent['kind'], string> = {
  request: 'Requested', approved: 'Approved', denied: 'Denied',
  revoked: 'Revoked', accessed: 'Accessed', killed: 'Blocked',
}
const EVENT_OPTIONS = Object.entries(KIND_LABELS).map(([value, label]) => ({ label, value }))

export default function AuditTableServer({
  events, total, state, pageSize, userId,
}: {
  events: AuditEvent[]
  total: number
  state: TableState
  pageSize: number
  userId?: string
}) {
  const columns: ServerColDef<AuditEvent>[] = [
    { id: 'when', label: 'Date & Time', defaultWidth: 160, renderCell: r => <span className="text-gray-500 text-xs whitespace-nowrap">{new Date(r.time).toLocaleString()}</span> },
    { id: 'event', label: 'Event', defaultWidth: 110, filter: { type: 'select', options: EVENT_OPTIONS }, renderCell: r => <span className={`px-2 py-1 rounded-full text-xs font-medium ${KIND_STYLES[r.kind]}`}>{KIND_LABELS[r.kind]}</span> },
    { id: 'app', label: 'App', defaultWidth: 140, filter: { type: 'text', placeholder: 'Search app…' }, renderCell: r => <span className="text-white">{r.app}</span> },
    { id: 'who', label: 'Device', defaultWidth: 180, filter: { type: 'text', placeholder: 'Search device…' }, renderCell: r => <span className="text-gray-300">{r.actor || '—'}</span> },
    { id: 'detail', label: 'Detail', defaultWidth: 220, sortable: false, renderCell: r => <span className="text-gray-500">{r.detail}</span> },
  ]

  return (
    <ServerDataTable
      storageId="audit-timeline"
      userId={userId}
      basePath="/admin/audit"
      state={state}
      columns={columns}
      rows={events}
      total={total}
      pageSize={pageSize}
      rowKey={r => r.time + r.actor + r.kind}
      emptyMessage="No activity yet."
    />
  )
}
