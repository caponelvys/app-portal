'use client'

import ServerDataTable, { ServerColDef } from '@/app/admin/ServerDataTable'
import { TableState } from '@/lib/tableParams'

type SoftwareRow = {
  name: string
  publisher: string | null
  device_count: number
  version_count: number
}

export default function SoftwareTableServer({
  rows, total, state, pageSize, userId,
}: {
  rows: SoftwareRow[]
  total: number
  state: TableState
  pageSize: number
  userId?: string
}) {
  const columns: ServerColDef<SoftwareRow>[] = [
    {
      id: 'name', label: 'Software', defaultWidth: 280, sortable: false,
      filter: { type: 'text', placeholder: 'Search software…' },
      renderCell: r => <span className="font-medium text-white">{r.name}</span>,
    },
    {
      id: 'publisher', label: 'Publisher', defaultWidth: 240, sortable: false,
      renderCell: r => r.publisher
        ? <span className="text-gray-400 text-sm">{r.publisher}</span>
        : <span className="text-gray-600 text-sm">—</span>,
    },
    {
      id: 'device_count', label: 'Devices', defaultWidth: 110, sortable: false,
      renderCell: r => <span className="text-white font-medium tabular-nums">{r.device_count.toLocaleString()}</span>,
    },
    {
      id: 'version_count', label: 'Versions', defaultWidth: 110, sortable: false,
      renderCell: r => <span className="text-gray-400 text-sm tabular-nums">{r.version_count.toLocaleString()}</span>,
    },
  ]

  return (
    <ServerDataTable
      storageId="fleet-software"
      userId={userId}
      basePath="/admin/monitor/software"
      state={state}
      columns={columns}
      rows={rows}
      total={total}
      pageSize={pageSize}
      rowKey={r => r.name}
      emptyMessage="No software reported yet. Devices report inventory once on agent v1.7.17+."
    />
  )
}
