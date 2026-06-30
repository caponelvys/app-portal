import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getCallerProfile, isMspStaff } from '@/lib/rbac'

export default async function MonitorPage() {
  const supabase = await createClient()

  const profile = await getCallerProfile(supabase)
  if (!profile) redirect('/login')
  if (!isMspStaff(profile)) redirect('/')

  const [{ data: logs }, { data: devices }] = await Promise.all([
    supabase.from('agent_logs').select('id, device_id, app_name, action, created_at').order('created_at', { ascending: false }).limit(200),
    supabase.from('devices').select('device_id, hostname'),
  ])

  const hostnameById = new Map((devices ?? []).map(d => [d.device_id, d.hostname]))

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Monitor</h1>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-gray-800 border-b border-gray-700">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-400">App</th>
              <th className="text-left px-4 py-3 font-medium text-gray-400">Action</th>
              <th className="text-left px-4 py-3 font-medium text-gray-400">Device</th>
              <th className="text-left px-4 py-3 font-medium text-gray-400">Time</th>
            </tr>
          </thead>
          <tbody>
            {(logs ?? []).length > 0 ? (logs ?? []).map(log => (
              <tr key={log.id} className="border-b border-gray-800 hover:bg-gray-800">
                <td className="px-4 py-3 font-medium text-white">{log.app_name}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                    log.action === 'killed' ? 'bg-red-900 text-red-400' :
                    log.action === 'accessed' ? 'bg-blue-900 text-blue-400' :
                    'bg-gray-800 text-gray-400'
                  }`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{hostnameById.get(log.device_id) ?? log.device_id.slice(0, 8) + '…'}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(log.created_at).toLocaleString()}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-gray-500">No activity recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
