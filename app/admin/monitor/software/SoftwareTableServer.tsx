'use client'

import { useState } from 'react'
import ServerDataTable, { ServerColDef } from '@/app/admin/ServerDataTable'
import { TableState } from '@/lib/tableParams'
import ManageSoftwareModal, { PromoteTarget } from './ManageSoftwareModal'

type SoftwareRow = {
  name: string
  publisher: string | null
  process_name: string | null
  device_count: number
  version_count: number
  managed: boolean
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
  const [manageTarget, setManageTarget] = useState<PromoteTarget | null>(null)

  const columns: ServerColDef<SoftwareRow>[] = [
    {
      id: 'name', label: 'Software', defaultWidth: 260, sortable: false,
      filter: { type: 'text', placeholder: 'Search software…' },
      renderCell: r => <span className="font-medium text-white">{r.name}</span>,
    },
    {
      id: 'publisher', label: 'Publisher', defaultWidth: 220, sortable: false,
      renderCell: r => r.publisher
        ? <span className="text-gray-400 text-sm">{r.publisher}</span>
        : <span className="text-gray-600 text-sm">—</span>,
    },
    {
      id: 'managed', label: 'Status', defaultWidth: 130, sortable: false,
      filter: { type: 'select', options: [{ label: 'Managed', value: 'managed' }, { label: 'Unmanaged', value: 'unmanaged' }] },
      renderCell: r => r.managed
        ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            Managed
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500">
            <span className="w-2 h-2 rounded-full bg-gray-600 shrink-0" />
            Unmanaged
          </span>
        ),
    },
    {
      id: 'device_count', label: 'Devices', defaultWidth: 100, sortable: false,
      renderCell: r => <span className="text-white font-medium tabular-nums">{r.device_count.toLocaleString()}</span>,
    },
    {
      id: 'version_count', label: 'Versions', defaultWidth: 100, sortable: false,
      renderCell: r => <span className="text-gray-400 text-sm tabular-nums">{r.version_count.toLocaleString()}</span>,
    },
    {
      id: 'actions', label: '', defaultWidth: 96, sortable: false, sticky: true,
      renderCell: r => r.managed ? (
        <span className="text-gray-600 text-xs">—</span>
      ) : (
        <button
          onClick={() => setManageTarget({ name: r.name, publisher: r.publisher, process_name: r.process_name })}
          className="rounded-md border border-gray-700 px-2.5 py-1 text-xs font-medium text-blue-300 hover:border-blue-500/60 hover:bg-blue-600/10 transition-colors"
        >
          Manage
        </button>
      ),
    },
  ]

  return (
    <>
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
      {manageTarget && (
        <ManageSoftwareModal target={manageTarget} onClose={() => setManageTarget(null)} />
      )}
    </>
  )
}
