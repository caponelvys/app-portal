'use client'

import DataTable, { ColDef } from '@/app/admin/DataTable'
import { isOnline } from '@/lib/deviceStatus'
import { cleanHostname } from '@/lib/hostname'

type Device = { device_id: string; hostname: string; os: string; last_seen: string }

const columns: ColDef<Device>[] = [
  {
    id: 'device', label: 'Device', defaultWidth: 220, sortValue: r => cleanHostname(r.hostname),
    filter: { type: 'text', value: (r: Device) => cleanHostname(r.hostname) },
    renderCell: d => (
      <a href={`/admin/devices/${d.device_id}`} className="text-blue-400 hover:text-blue-300 font-medium">
        {cleanHostname(d.hostname) || 'Unknown device'}
      </a>
    ),
  },
  {
    id: 'os', label: 'OS', defaultWidth: 120, sortValue: r => r.os,
    filter: { type: 'select', value: (r: Device) => r.os },
    renderCell: d => <span className="text-gray-400">{d.os}</span>,
  },
  {
    id: 'status', label: 'Status', defaultWidth: 110, sortValue: r => isOnline(r.last_seen) ? 0 : 1,
    filter: { type: 'select', value: (r: Device) => isOnline(r.last_seen) ? 'online' : 'offline', options: [{ label: 'Online', value: 'online' }, { label: 'Offline', value: 'offline' }] },
    renderCell: d => {
      const online = isOnline(d.last_seen)
      return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${online ? 'text-green-400' : 'text-gray-500'}`}>
          <span className={`w-2 h-2 rounded-full ${online ? 'bg-green-400' : 'bg-gray-600'}`} />
          {online ? 'Online' : 'Offline'}
        </span>
      )
    },
  },
  {
    id: 'lastSeen', label: 'Last seen', defaultWidth: 180, sortValue: r => r.last_seen,
    filter: { type: 'time-range', value: (r: Device) => r.last_seen },
    renderCell: d => <span className="text-gray-500 text-xs">{d.last_seen ? new Date(d.last_seen).toLocaleString() : '—'}</span>,
  },
]

export default function DevicesTable({ devices, userId }: { devices: Device[]; userId?: string }) {
  return (
    <DataTable
      storageId="location-devices-table" userId={userId}
      columns={columns}
      rows={devices}
      rowKey={r => r.device_id}
      emptyMessage="No devices at this location."
    />
  )
}
