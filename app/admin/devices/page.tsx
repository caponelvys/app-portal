import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import InstallCommands from './InstallCommands'

export default async function AdminDevicesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/')

  const { data: devices } = await supabase
    .from('devices')
    .select('*')
    .order('last_seen', { ascending: false })

  const { data: logs } = await supabase
    .from('agent_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  function osLabel(os: string) {
    if (os === 'Darwin') return 'macOS'
    if (os === 'Windows') return 'Windows'
    return os
  }

  function deviceHostname(deviceId: string) {
    return devices?.find(d => d.device_id === deviceId)?.hostname ?? deviceId.slice(0, 8) + '...'
  }

  function isOnline(lastSeen: string) {
    const diff = Date.now() - new Date(lastSeen).getTime()
    return diff < 60 * 1000
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/admin" className="text-gray-500 hover:text-gray-300 text-sm">← Apps</a>
          <h1 className="text-xl font-bold text-white">Devices</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400 hidden sm:block">{user.email}</span>
          <a href="/auth/signout" className="text-sm text-gray-400 hover:text-gray-200 underline">Sign out</a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-10">

        {/* Enrolled devices */}
        <div>
          <h2 className="text-2xl font-semibold text-white mb-4">Enrolled Devices</h2>
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
                {devices && devices.length > 0 ? devices.map((device) => (
                  <tr key={device.id} className="border-b border-gray-800 hover:bg-gray-800">
                    <td className="px-4 py-3 font-medium text-white">{device.hostname}</td>
                    <td className="px-4 py-3 text-gray-400">{osLabel(device.os)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                        isOnline(device.last_seen)
                          ? 'bg-green-900 text-green-400'
                          : 'bg-gray-800 text-gray-500'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isOnline(device.last_seen) ? 'bg-green-400' : 'bg-gray-500'}`} />
                        {isOnline(device.last_seen) ? 'Online' : 'Offline'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(device.last_seen).toLocaleString()}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                      No devices enrolled yet. Install the agent on a device to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Download agent */}
        <div>
          <h2 className="text-2xl font-semibold text-white mb-2">Install Agent</h2>
          <p className="text-sm text-gray-500 mb-4">Download the installer or run a command directly in your terminal.</p>
          <p className="text-xs text-gray-600 uppercase tracking-wider mb-2">Download</p>
          <div className="flex flex-wrap gap-3 mb-6">
            <a href="/downloads/install_win.bat" download
              className="bg-gray-800 border border-gray-700 text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-700 text-sm font-medium">
              Windows Installer
            </a>
            <a href="/downloads/install_mac.sh" download
              className="bg-gray-800 border border-gray-700 text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-700 text-sm font-medium">
              Mac Installer
            </a>
            <a href="/downloads/install_linux.sh" download
              className="bg-gray-800 border border-gray-700 text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-700 text-sm font-medium">
              Linux Installer
            </a>
          </div>
          <p className="text-xs text-gray-600 uppercase tracking-wider mb-2">Install via Terminal</p>
          <InstallCommands />
        </div>

        {/* Recent enforcement logs */}
        <div>
          <h2 className="text-2xl font-semibold text-white mb-4">Recent Activity</h2>
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead className="bg-gray-800 border-b border-gray-700">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-400">App</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-400">Action</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-400">Device</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-400">Time</th>
                </tr>
              </thead>
              <tbody>
                {logs && logs.length > 0 ? logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-800 hover:bg-gray-800">
                    <td className="px-4 py-3 font-medium text-white">{log.app_name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-red-900 text-red-400">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{deviceHostname(log.device_id)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                      No activity yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  )
}
