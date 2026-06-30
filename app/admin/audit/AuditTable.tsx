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

const columns: ColDef<AuditEvent>[] = [
  { id: 'when',   label: 'When',   defaultWidth: 180, sortValue: r => r.time,   renderCell: r => <span className="text-gray-500 text-xs whitespace-nowrap">{new Date(r.time).toLocaleString()}</span> },
  { id: 'event',  label: 'Event',  defaultWidth: 120, sortValue: r => r.kind,   renderCell: r => <span className={`px-2 py-1 rounded-full text-xs font-medium ${KIND_STYLES[r.kind]}`}>{KIND_LABELS[r.kind]}</span> },
  { id: 'app',    label: 'App',    defaultWidth: 160, sortValue: r => r.app,    renderCell: r => <span className="text-white">{r.app}</span> },
  { id: 'who',    label: 'Who',    defaultWidth: 200, sortValue: r => r.actor,  renderCell: r => <span className="text-gray-300">{r.actor}</span> },
  { id: 'detail', label: 'Detail', defaultWidth: 240, sortValue: r => r.detail, renderCell: r => <span className="text-gray-500">{r.detail}</span> },
]

export default function AuditTable({ events }: { events: AuditEvent[] }) {
  return (
    <DataTable
      storageId="audit-table"
      columns={columns}
      rows={events}
      rowKey={r => r.time + r.actor + r.kind}
      emptyMessage="No activity yet."
    />
  )
}
