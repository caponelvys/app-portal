'use client'

import DataTable, { ColDef } from '@/app/admin/DataTable'

type Log = { id: string; app_name: string; action: string; created_at: string; device_id: string }

export default function ActivityTable({ logs, hostnameById }: { logs: Log[]; hostnameById: Record<string, string> }) {
  const columns: ColDef<Log>[] = [
    {
      id: 'app', label: 'App', defaultWidth: 180, sortValue: r => r.app_name,
      renderCell: r => <span className="font-medium text-white">{r.app_name}</span>,
    },
    {
      id: 'action', label: 'Action', defaultWidth: 120, sortValue: r => r.action,
      renderCell: r => (
        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${r.action === 'killed' ? 'bg-red-900 text-red-400' : r.action === 'accessed' ? 'bg-blue-900 text-blue-300' : 'bg-gray-800 text-gray-400'}`}>
          {r.action === 'killed' ? 'Blocked' : r.action === 'accessed' ? 'Accessed' : r.action}
        </span>
      ),
    },
    {
      id: 'device', label: 'Device', defaultWidth: 180, sortValue: r => hostnameById[r.device_id] ?? r.device_id,
      renderCell: r => <span className="text-gray-400 text-xs">{hostnameById[r.device_id] ?? r.device_id.slice(0, 8) + '…'}</span>,
    },
    {
      id: 'time', label: 'Time', defaultWidth: 180, sortValue: r => r.created_at,
      renderCell: r => <span className="text-gray-500 text-xs">{new Date(r.created_at).toLocaleString()}</span>,
    },
  ]

  return (
    <DataTable
      storageId="monitor-table"
      columns={columns}
      rows={logs}
      rowKey={r => r.id}
      emptyMessage="No activity recorded yet."
    />
  )
}
