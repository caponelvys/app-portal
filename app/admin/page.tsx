import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getCallerProfile, isMspStaff } from '@/lib/rbac'

const HEALTHY_MS = 2 * 60 * 1000
const WARNING_MS = 24 * 60 * 60 * 1000
const STALE_MS   = 30 * 24 * 60 * 60 * 1000

type HealthTier = 'healthy' | 'warning' | 'stale' | 'lost' | 'never'

function getHealth(lastSeen: string | null): HealthTier {
  if (!lastSeen) return 'never'
  const age = Date.now() - new Date(lastSeen).getTime()
  if (age < HEALTHY_MS) return 'healthy'
  if (age < WARNING_MS) return 'warning'
  if (age < STALE_MS)   return 'stale'
  return 'lost'
}

const HEALTH_META: Record<HealthTier, { label: string; dot: string; bar: string; text: string }> = {
  healthy: { label: 'Healthy',    dot: 'bg-green-500',  bar: 'bg-green-500',  text: 'text-green-400' },
  warning: { label: 'Warning',    dot: 'bg-yellow-500', bar: 'bg-yellow-400', text: 'text-yellow-400' },
  stale:   { label: 'Stale',      dot: 'bg-orange-500', bar: 'bg-orange-500', text: 'text-orange-400' },
  lost:    { label: 'Lost',       dot: 'bg-red-600',    bar: 'bg-red-600',    text: 'text-red-400' },
  never:   { label: 'Never seen', dot: 'bg-gray-600',   bar: 'bg-gray-600',   text: 'text-gray-500' },
}

export default async function AdminDashboard() {
  const supabase = await createClient()
  const profile = await getCallerProfile(supabase)
  if (!profile) redirect('/login')
  if (!isMspStaff(profile)) redirect('/')

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: orgs },
    { data: devices },
    { count: pendingCount },
    { data: recentLogs },
    { data: logs24h },
  ] = await Promise.all([
    supabase.from('orgs').select('id, name'),
    supabase.from('devices').select('device_id, hostname, last_seen, org_id'),
    supabase.from('app_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('agent_logs').select('app_name, action, created_at').order('created_at', { ascending: false }).limit(8),
    supabase.from('agent_logs').select('app_name, action').gte('created_at', since24h),
  ])

  const devList = devices ?? []
  const totalDevices = devList.length

  // Health tiers
  const tiers: Record<HealthTier, typeof devList> = { healthy: [], warning: [], stale: [], lost: [], never: [] }
  for (const d of devList) tiers[getHealth(d.last_seen)].push(d)

  const attentionDevices = [...tiers.warning, ...tiers.stale, ...tiers.lost, ...tiers.never]
    .sort((a, b) => (b.last_seen ?? '').localeCompare(a.last_seen ?? ''))
    .slice(0, 5)

  // Orgs with no enrolled devices
  const orgsWithDevices = new Set(devList.map(d => d.org_id).filter(Boolean))
  const unenrolledOrgs = (orgs ?? []).filter(o => !orgsWithDevices.has(o.id))

  // 24h enforcement
  const l24 = logs24h ?? []
  const blockedToday  = l24.filter(l => l.action === 'killed').length
  const accessedToday = l24.filter(l => l.action === 'accessed').length

  // Top blocked apps last 24h
  const blockCounts = new Map<string, number>()
  for (const l of l24.filter(l => l.action === 'killed'))
    blockCounts.set(l.app_name, (blockCounts.get(l.app_name) ?? 0) + 1)
  const topBlocked = [...blockCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-white">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Organizations"    value={orgs?.length ?? 0}  href="/admin/orgs"     />
        <StatCard label="Total Devices"    value={totalDevices}        href="/admin/devices"  />
        <StatCard label="Online Now"       value={tiers.healthy.length} href="/admin/devices" accent="green" />
        <StatCard label="Pending Requests" value={pendingCount ?? 0}   href="/admin/requests" accent={pendingCount ? 'yellow' : undefined} />
      </div>

      {/* Agent Health + Needs Attention */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Agent Health</h2>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
            {(['healthy', 'warning', 'stale', 'lost', 'never'] as HealthTier[]).map(tier => {
              const count = tiers[tier].length
              const meta = HEALTH_META[tier]
              const pct = totalDevices > 0 ? (count / totalDevices) * 100 : 0
              return (
                <div key={tier}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
                      <span className="text-gray-300">{meta.label}</span>
                    </div>
                    <span className={`font-semibold ${count > 0 && tier !== 'healthy' ? meta.text : 'text-gray-400'}`}>{count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
            <p className="text-xs text-gray-600 pt-1 border-t border-gray-800">
              Healthy &lt;2 min · Warning &lt;24 hr · Stale &lt;30 days · Lost &gt;30 days
            </p>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Needs Attention</h2>
            {attentionDevices.length > 0 && <a href="/admin/devices" className="text-xs text-blue-400 hover:text-blue-300">View all</a>}
          </div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            {attentionDevices.length > 0 ? (
              <div className="divide-y divide-gray-800">
                {attentionDevices.map(d => {
                  const tier = getHealth(d.last_seen)
                  const meta = HEALTH_META[tier]
                  return (
                    <a key={d.device_id} href={`/admin/devices/${d.device_id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition-colors">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white truncate">{d.hostname?.split('.')[0] ?? 'Unknown'}</p>
                        <p className={`text-xs ${meta.text}`}>{meta.label}</p>
                      </div>
                      <span className="text-xs text-gray-600 whitespace-nowrap">
                        {d.last_seen ? new Date(d.last_seen).toLocaleDateString() : 'Never'}
                      </span>
                    </a>
                  )
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-sm px-4 py-6">All devices are healthy.</p>
            )}
          </div>
        </section>
      </div>

      {/* Enforcement + Top Blocked */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Enforcement — Last 24h</h2>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 grid grid-cols-2 gap-6">
            <div>
              <p className="text-3xl font-bold text-red-400">{blockedToday}</p>
              <p className="text-xs text-gray-500 mt-1">Apps blocked</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-blue-400">{accessedToday}</p>
              <p className="text-xs text-gray-500 mt-1">Granted apps accessed</p>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Top Blocked Apps — 24h</h2>
            <a href="/admin/monitor" className="text-xs text-blue-400 hover:text-blue-300">View all</a>
          </div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            {topBlocked.length > 0 ? (
              <div className="divide-y divide-gray-800">
                {topBlocked.map(([name, count]) => (
                  <div key={name} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-white">{name}</span>
                    <span className="text-xs font-semibold text-red-400 bg-red-950 px-2 py-0.5 rounded-full">{count}×</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm px-4 py-6">No blocks in the last 24 hours.</p>
            )}
          </div>
        </section>
      </div>

      {/* Recent Activity + Unenrolled Orgs + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Recent Activity</h2>
            <a href="/admin/monitor" className="text-xs text-blue-400 hover:text-blue-300">View all</a>
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

        <div className="space-y-6">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Orgs Not Enrolled</h2>
              <a href="/admin/orgs" className="text-xs text-blue-400 hover:text-blue-300">View all</a>
            </div>
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              {unenrolledOrgs.length > 0 ? (
                <div className="divide-y divide-gray-800">
                  {unenrolledOrgs.slice(0, 5).map(org => (
                    <a key={org.id} href={`/admin/orgs/${org.id}/install`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-800 transition-colors">
                      <span className="text-sm text-white truncate">{org.name}</span>
                      <span className="text-xs text-yellow-400 bg-yellow-950 px-2 py-0.5 rounded-full shrink-0 ml-2">No devices</span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm px-4 py-6">All orgs have enrolled devices.</p>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              <QuickAction href="/admin/orgs"        label="Add Org" />
              <QuickAction href="/admin/users/invite" label="Invite User" />
              <QuickAction href="/admin/new"          label="Add App" />
              <QuickAction href="/admin/orgs"         label="Install Agent" />
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

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-gray-300 hover:text-white hover:border-gray-600 hover:bg-gray-800 transition-colors text-center">
      {label}
    </a>
  )
}
