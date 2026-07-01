'use client'

import DataTable, { ColDef } from '@/app/admin/DataTable'
import { getHealthTier, TIER_LABEL, TIER_COLOR, TIER_DOT } from '@/lib/deviceStatus'
import { cleanHostname } from '@/lib/hostname'

type Device = { device_id: string; hostname: string; os: string; last_seen: string; agent_version: string | null }

const TIER_RANK = ['healthy', 'inactive', 'warning', 'stale', 'lost', 'never']

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
    id: 'status', label: 'Status', defaultWidth: 120, sortValue: r => TIER_RANK.indexOf(getHealthTier(r.last_seen)),
    filter: { type: 'select', value: (r: Device) => TIER_LABEL[getHealthTier(r.last_seen)] },
    renderCell: d => {
      const tier = getHealthTier(d.last_seen)
      return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${TIER_COLOR[tier]}`}>
          <span className={`w-2 h-2 rounded-full ${TIER_DOT[tier]}`} />
          {TIER_LABEL[tier]}
        </span>
      )
    },
  },
  {
    id: 'agentVersion', label: 'Agent Version', defaultWidth: 130, sortValue: r => r.agent_version ?? '',
    filter: { type: 'select', value: (r: Device) => r.agent_version ?? '—' },
    renderCell: d => <span className="text-gray-400 font-mono text-xs">{d.agent_version ?? '—'}</span>,
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
