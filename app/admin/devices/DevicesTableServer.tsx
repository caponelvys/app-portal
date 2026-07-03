'use client'

import ServerDataTable, { ServerColDef } from '@/app/admin/ServerDataTable'
import { TableState } from '@/lib/tableParams'
import { getHealthTier, TIER_LABEL, TIER_COLOR, TIER_DOT, HealthTier } from '@/lib/deviceStatus'
import { cleanHostname } from '@/lib/hostname'
import DeviceActionsMenu from './DeviceActionsMenu'

type Device = {
  id: string
  device_id: string
  hostname: string
  os: string
  last_seen: string
  agent_version?: string | null
  ip_address?: string | null
  user_id?: string | null
  locations?: { name: string } | null
  orgs?: { name: string } | null
}

type Option = { label: string; value: string }

const STATUS_TIERS: HealthTier[] = ['healthy', 'inactive', 'warning', 'stale', 'lost', 'never']

export default function DevicesTableServer({
  devices, total, state, pageSize, userId, orgOptions, locationOptions, versionOptions,
}: {
  devices: Device[]
  total: number
  state: TableState
  pageSize: number
  userId?: string
  orgOptions: Option[]
  locationOptions: Option[]
  versionOptions: Option[]
}) {
  const columns: ServerColDef<Device>[] = [
    {
      id: 'hostname', label: 'Device', defaultWidth: 180,
      filter: { type: 'text', placeholder: 'Search device…' },
      renderCell: d => (
        <a href={`/admin/devices/${d.device_id}`} className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
          {cleanHostname(d.hostname)}
        </a>
      ),
    },
    {
      id: 'os', label: 'OS', defaultWidth: 130,
      filter: { type: 'text', placeholder: 'Search OS…' },
      renderCell: d => <span className="text-gray-400 text-sm">{d.os}</span>,
    },
    {
      id: 'status', label: 'Status', defaultWidth: 130,
      filter: { type: 'select', options: STATUS_TIERS.map(t => ({ label: TIER_LABEL[t], value: t })) },
      renderCell: d => {
        const tier = getHealthTier(d.last_seen)
        return (
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${TIER_COLOR[tier]}`}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${TIER_DOT[tier]}`} />
            {TIER_LABEL[tier]}
          </span>
        )
      },
    },
    {
      id: 'org', label: 'Organization', defaultWidth: 150,
      filter: { type: 'select', options: orgOptions },
      renderCell: d => <span className="text-gray-400 text-sm">{d.orgs?.name ?? <span className="text-gray-600">—</span>}</span>,
    },
    {
      id: 'location', label: 'Location', defaultWidth: 140,
      filter: { type: 'select', options: locationOptions },
      renderCell: d => <span className="text-gray-400 text-sm">{d.locations?.name ?? <span className="text-gray-600">—</span>}</span>,
    },
    {
      id: 'agentVersion', label: 'Agent Version', defaultWidth: 130,
      filter: { type: 'select', options: versionOptions },
      renderCell: d => d.agent_version
        ? <span className="text-gray-300 font-mono text-xs">{d.agent_version}</span>
        : <span className="text-gray-600 text-xs">—</span>,
    },
    {
      id: 'ipAddress', label: 'IP Address', defaultWidth: 130, sortable: false,
      renderCell: d => <span className="text-gray-400 font-mono text-xs">{d.ip_address ?? <span className="text-gray-600">—</span>}</span>,
    },
    {
      id: 'lastSeen', label: 'Last Seen', defaultWidth: 160,
      filter: { type: 'time-range' },
      renderCell: d => <span className="text-gray-500 text-xs">{d.last_seen ? new Date(d.last_seen).toLocaleString() : '—'}</span>,
    },
    {
      id: 'actions', label: '', defaultWidth: 56, sticky: true, sortable: false,
      renderCell: d => (
        <div className="text-right">
          <DeviceActionsMenu deviceId={d.device_id} hostname={cleanHostname(d.hostname) || d.device_id} hasOwner={!!d.user_id} />
        </div>
      ),
    },
  ]

  return (
    <ServerDataTable
      storageId="all-devices"
      userId={userId}
      basePath="/admin/devices"
      state={state}
      columns={columns}
      rows={devices}
      total={total}
      pageSize={pageSize}
      rowKey={d => d.id}
      emptyMessage="No devices enrolled yet."
    />
  )
}
