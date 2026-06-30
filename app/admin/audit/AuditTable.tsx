'use client'

import DataTable, { ColDef } from '@/app/admin/DataTable'

type AuditEvent = {
  time: string
  kind: 'request' | 'approved' | 'denied' | 'revoked' | 'accessed' | 'killed'
  app: string
  actor: string
  detail: string
}

const KIND_STYLES: Record<AuditEvent['kind'], string> = {
  request: 'bg-yellow-900 text-yellow-400', approved: 'bg-green-950 text-green-400',
  denied: 'bg-red-950 text-red-400', revoked: 'bg-red-950 text-red-400',
  accessed: 'bg-blue-950 text-blue-300', killed: 'bg-gray-800 text-gray-400',
}
const KIND_LABELS: Record<AuditEvent['kind'], string> = {
  request: 'Requested', approved: 'Approved', denied: 'Denied',
  revoked: 'Revoked', accessed: 'Accessed', killed: 'Blocked',
}

const EVENT_OPTIONS = Object.entries(KIND_LABELS).map(([value, label]) => ({ label, value }))

const columns: ColDef<AuditEvent>[] = [
  { id: 'when',   label: 'When',   defaultWidth: 180, sortValue: r => r.time,   filter: { type: 'time-range', value: (r: AuditEvent) => r.time },  renderCell: r => <span className="text-gray-500 text-xs whitespace-nowrap">{new Date(r.time).toLocaleString()}</span> },
  { id: 'event',  label: 'Event',  defaultWidth: 120, sortValue: r => r.kind,   filter: { type: 'select', value: (r: AuditEvent) => r.kind, options: EVENT_OPTIONS }, renderCell: r => <span className={`px-2 py-1 rounded-full text-xs font-medium ${KIND_STYLES[r.kind]}`}>{KIND_LABELS[r.kind]}</span> },
  { id: 'app',    label: 'App',    defaultWidth: 160, sortValue: r => r.app,    filter: { type: 'text',   value: (r: AuditEvent) => r.app },   renderCell: r => <span className="text-white">{r.app}</span> },
  { id: 'who',    label: 'Who',    defaultWidth: 200, sortValue: r => r.actor,  filter: { type: 'text',   value: (r: AuditEvent) => r.actor }, renderCell: r => <span className="text-gray-300">{r.actor}</span> },
  { id: 'detail', label: 'Detail', defaultWidth: 240, sortValue: r => r.detail,                                                                renderCell: r => <span className="text-gray-500">{r.detail}</span> },
]

export default function AuditTable({ events, userId }: { events: AuditEvent[]; userId?: string }) {
  return (
    <DataTable
      storageId="audit-table" userId={userId}
      columns={columns}
      rows={events}
      rowKey={r => r.time + r.actor + r.kind}
      emptyMessage="No activity yet."
    />
  )
}
