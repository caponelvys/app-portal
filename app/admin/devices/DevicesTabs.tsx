'use client'

type Device = {
  id: string
  device_id: string
  hostname: string
  os: string
  last_seen: string
}

function osLabel(os: string) {
  if (os === 'Darwin') return 'macOS'
  if (os === 'Windows') return 'Windows'
  return os
}

function isOnline(lastSeen: string) {
  return Date.now() - new Date(lastSeen).getTime() < 2 * 60 * 1000
}

export default function DevicesTabs({ devices }: { devices: Device[] }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden overflow-x-auto">
      <table className="w-full text-sm min-w-[500px]">
        <thead className="bg-gray-800 border-b border-gray-700">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-400">Hostname</th>
            <th className="text-left px-4 py-3 font-medium text-gray-400">OS</th>
            <th className="text-left px-4 py-3 font-medium text-gray-400">Status</th>
            <th className="text-left px-4 py-3 font-medium text-gray-400">Last Seen</th>
          </tr>
        </thead>
        <tbody>
          {devices.length > 0 ? devices.map((device) => (
            <tr key={device.id} className="border-b border-gray-800 hover:bg-gray-800">
              <td className="px-4 py-3 font-medium text-white">
                <a href={`/admin/devices/${device.device_id}`} className="hover:text-blue-400 transition-colors">
                  {device.hostname}
                </a>
              </td>
              <td className="px-4 py-3 text-gray-400">{osLabel(device.os)}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                  isOnline(device.last_seen) ? 'bg-green-900 text-green-400' : 'bg-gray-800 text-gray-500'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline(device.last_seen) ? 'bg-green-400' : 'bg-gray-500'}`} />
                  {isOnline(device.last_seen) ? 'Online' : 'Offline'}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-500 text-xs">{new Date(device.last_seen).toLocaleString()}</td>
            </tr>
          )) : (
            <tr>
              <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                No devices enrolled yet. Select an organization and use Install Agent to get started.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
