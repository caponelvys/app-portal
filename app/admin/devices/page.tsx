import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

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

  function isOnline(lastSeen: string) {
    const diff = Date.now() - new Date(lastSeen).getTime()
    return diff < 60 * 1000 // online if seen within last 60 seconds
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/admin" className="text-gray-400 hover:text-gray-600 text-sm">← Apps</a>
          <h1 className="text-xl font-bold text-gray-800">Admin — Devices</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user.email}</span>
          <a href="/auth/signout" className="text-sm text-gray-500 hover:text-gray-800 underline">Sign out</a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-10">

        {/* Enrolled devices */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Enrolled Devices</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Hostname</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">OS</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {devices && devices.length > 0 ? devices.map((device) => (
                  <tr key={device.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{device.hostname}</td>
                    <td className="px-4 py-3 text-gray-500">{device.os}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                        isOnline(device.last_seen)
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isOnline(device.last_seen) ? 'bg-green-500' : 'bg-gray-400'}`} />
                        {isOnline(device.last_seen) ? 'Online' : 'Offline'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(device.last_seen).toLocaleString()}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-gray-400">
                      No devices enrolled yet. Install the agent on a device to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent enforcement logs */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Recent Activity</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">App</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Action</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Device</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Time</th>
                </tr>
              </thead>
              <tbody>
                {logs && logs.length > 0 ? logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{log.app_name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-600">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono">{log.device_id.slice(0, 8)}...</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-gray-400">
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
