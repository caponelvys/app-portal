import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getCallerProfile, isMspStaff } from '@/lib/rbac'
import { isOnline } from '@/lib/deviceStatus'

export default async function AdminDashboard() {
  const supabase = await createClient()
  const profile = await getCallerProfile(supabase)
  if (!profile) redirect('/login')
  if (!isMspStaff(profile)) redirect('/')

  const [
    { count: orgCount },
    { data: devices },
    { count: pendingCount },
    { data: recentLogs },
    { data: recentRequests },
    { data: apps },
  ] = await Promise.all([
    supabase.from('orgs').select('id', { count: 'exact', head: true }),
    supabase.from('devices').select('device_id, hostname, os, last_seen, org_id'),
    supabase.from('app_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('agent_logs').select('app_name, action, created_at, device_id').order('created_at', { ascending: false }).limit(8),
    supabase.from('app_requests').select('id, status, created_at, app_id').order('created_at', { ascending: false }).limit(5),
    supabase.from('apps').select('id, name'),
  ])

  const totalDevices = devices?.length ?? 0
  const onlineDevices = (devices ?? []).filter(d => isOnline(d.last_seen)).length

  const appName = new Map((apps ?? []).map(a => [a.id, a.name]))

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Organizations" value={orgCount ?? 0} href="/admin/orgs" />
        <StatCard label="Total Devices" value={totalDevices} href="/admin/devices" />
        <StatCard label="Online Now" value={onlineDevices} href="/admin/devices" accent="green" />
        <StatCard label="Pending Requests" value={pendingCount ?? 0} href="/admin/requests" accent={pendingCount ? 'yellow' : undefined} />
      </div>

      {/* Two column content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Recent Activity</h2>
            <a href="/admin/audit" className="text-xs text-blue-400 hover:text-blue-300">View all</a>
          </div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            {recentLogs && recentLogs.length > 0 ? (
              <div className="divide-y divide-gray-800">
                {recentLogs.map((log, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${log.action === 'killed' ? 'bg-red-500' : 'bg-blue-500'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{log.app_name}</p>
                      <p className="text-xs text-gray-500">{log.action === 'killed' ? 'Blocked' : 'Accessed'}</p>
                    </div>
                    <span className="text-xs text-gray-600 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm px-4 py-6">No activity yet.</p>
            )}
          </div>
        </section>

        {/* Device status + quick actions */}
        <div className="space-y-6">
          <section>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Device Status</h2>
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
              <StatusBar label="Online" count={onlineDevices} total={totalDevices} color="bg-green-500" />
              <StatusBar label="Offline" count={totalDevices - onlineDevices} total={totalDevices} color="bg-gray-700" />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              <QuickAction href="/admin/orgs" label="Add Org" />
              <QuickAction href="/admin/users/invite" label="Invite User" />
              <QuickAction href="/admin/new" label="Add App" />
              <QuickAction href="/admin/devices?tab=install" label="Install Agent" />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, href, accent }: { label: string; value: number; href: string; accent?: 'green' | 'yellow' }) {
  const valueColor = accent === 'green' ? 'text-green-400' : accent === 'yellow' && value > 0 ? 'text-yellow-400' : 'text-white'
  return (
    <a href={href} className="bg-gray-900 rounded-xl border border-gray-800 p-5 hover:border-gray-700 transition-colors block">
      <p className={`text-3xl font-bold ${valueColor}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </a>
  )
}

function StatusBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{label}</span>
        <span>{count} / {total}</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-gray-300 hover:text-white hover:border-gray-600 hover:bg-gray-800 transition-colors text-center"
    >
      {label}
    </a>
  )
}
