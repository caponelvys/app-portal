import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { redirect } from 'next/navigation'
import { getCallerProfile, isMspStaff } from '@/lib/rbac'
import { cleanHostname } from '@/lib/hostname'
import { AGENT_VERSION, isVersionBehind } from '@/lib/agentVersion'
import DashboardLayout from './DashboardLayout'
import ActivityChart from './ActivityChart'

const HEALTHY_MS  = 2  * 60 * 1000
const INACTIVE_MS = 14 * 24 * 60 * 60 * 1000   // 2 weeks
const WARNING_MS  = 30 * 24 * 60 * 60 * 1000   // 30 days
const STALE_MS    = 90 * 24 * 60 * 60 * 1000   // 90 days

type HealthTier = 'healthy' | 'inactive' | 'warning' | 'stale' | 'lost' | 'never'

function getHealth(lastSeen: string | null): HealthTier {
  if (!lastSeen) return 'never'
  const age = Date.now() - new Date(lastSeen).getTime()
  if (age < HEALTHY_MS)  return 'healthy'
  if (age < INACTIVE_MS) return 'inactive'
  if (age < WARNING_MS)  return 'warning'
  if (age < STALE_MS)    return 'stale'
  return 'lost'
}

const HEALTH_META: Record<HealthTier, { label: string; dot: string; bar: string; text: string }> = {
  healthy:  { label: 'Healthy',    dot: 'bg-green-500',  bar: 'bg-green-500',  text: 'text-green-400'  },
  inactive: { label: 'Inactive',   dot: 'bg-blue-400',   bar: 'bg-blue-400',   text: 'text-blue-400'   },
  warning:  { label: 'Warning',    dot: 'bg-yellow-500', bar: 'bg-yellow-400', text: 'text-yellow-400' },
  stale:    { label: 'Stale',      dot: 'bg-orange-500', bar: 'bg-orange-500', text: 'text-orange-400' },
  lost:     { label: 'Lost',       dot: 'bg-red-600',    bar: 'bg-red-600',    text: 'text-red-400'    },
  never:    { label: 'Never seen', dot: 'bg-gray-600',   bar: 'bg-gray-600',   text: 'text-gray-500'   },
}

export default async function AdminDashboard() {
  const supabase = await createClient()
  const profile = await getCallerProfile(supabase)
  if (!profile) redirect('/login')
  if (!isMspStaff(profile)) redirect('/')

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  // app_requests is only visible to a user's own rows under RLS, so count
  // pending requests with the service-role client (same as the nav badge and
  // the /api/app-requests routes) to see all staff-reviewable requests.
  const admin = createAdminClient()
  const notHealthyBefore = new Date(Date.now() - HEALTHY_MS).toISOString()

  const [
    { data: orgs },
    { data: healthRows },
    { data: versionRows },
    { data: orgCountRows },
    { data: attentionData },
    { data: outdatedData },
    { count: pendingCount },
    { data: recentLogs },
    { data: logs24h },
    { data: logs14d },
  ] = await Promise.all([
    supabase.from('orgs').select('id, name'),
    // Exact fleet aggregates via grouped-count RPCs (no row loading).
    admin.rpc('device_health_counts'),
    admin.rpc('device_version_counts'),
    admin.rpc('org_device_counts'),
    // Bounded previews for the two device lists — just the worst few rows.
    admin.from('devices').select('device_id, hostname, last_seen').or(`last_seen.is.null,last_seen.lt.${notHealthyBefore}`).order('last_seen', { ascending: false }).limit(6),
    admin.from('devices').select('device_id, hostname, agent_version').or(`agent_version.neq.${AGENT_VERSION},agent_version.is.null`).order('last_seen', { ascending: false }).limit(6),
    admin.from('app_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('agent_logs').select('app_name, action, created_at').order('created_at', { ascending: false }).limit(8),
    supabase.from('agent_logs').select('app_name, action').gte('created_at', since24h).limit(5000),
    supabase.from('agent_logs').select('action, created_at').gte('created_at', since14d).limit(5000),
  ])

  const tierCounts: Record<HealthTier, number> = { healthy: 0, inactive: 0, warning: 0, stale: 0, lost: 0, never: 0 }
  for (const r of (healthRows ?? []) as { tier: HealthTier; count: number }[]) tierCounts[r.tier] = Number(r.count)
  const totalDevices = Object.values(tierCounts).reduce((a, b) => a + b, 0)

  const attentionDevices = (attentionData ?? []) as { device_id: string; hostname: string; last_seen: string | null }[]

  const outdatedCount = ((versionRows ?? []) as { agent_version: string; count: number }[])
    .filter(v => isVersionBehind(v.agent_version === 'unknown' ? null : v.agent_version))
    .reduce((sum, v) => sum + Number(v.count), 0)
  const outdatedList = (outdatedData ?? []) as { device_id: string; hostname: string; agent_version: string | null }[]

  const orgsWithDevices = new Set(((orgCountRows ?? []) as { org_id: string; total: number }[]).filter(o => Number(o.total) > 0).map(o => o.org_id))
  const unenrolledOrgs = (orgs ?? []).filter(o => !orgsWithDevices.has(o.id))

  const l24 = logs24h ?? []
  const blockedToday  = l24.filter(l => l.action === 'killed').length
  const accessedToday = l24.filter(l => l.action === 'accessed').length

  const blockCounts = new Map<string, number>()
  for (const l of l24.filter(l => l.action === 'killed'))
    blockCounts.set(l.app_name, (blockCounts.get(l.app_name) ?? 0) + 1)
  const topBlocked = [...blockCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  // 14-day activity buckets (UTC days) for the trend chart.
  const activityDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 24 * 60 * 60 * 1000)
    return { key: d.toISOString().slice(0, 10), label: `${d.getUTCMonth() + 1}/${d.getUTCDate()}`, blocked: 0, accessed: 0 }
  })
  const dayByKey = new Map(activityDays.map(d => [d.key, d]))
  for (const l of logs14d ?? []) {
    const day = dayByKey.get((l.created_at as string).slice(0, 10))
    if (!day) continue
    if (l.action === 'killed') day.blocked++
    else if (l.action === 'accessed') day.accessed++
  }

  // ── Widgets ──────────────────────────────────────────────────────────────

  const agentHealth = (
    <Widget title="Agent Health">
      <div className="space-y-4">
        {(['healthy', 'inactive', 'warning', 'stale', 'lost', 'never'] as HealthTier[]).map(tier => {
          const count = tierCounts[tier]
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
          Healthy &lt;2 min · Inactive no heartbeat 15+ min · Warning &gt;2 weeks · Stale &gt;30 days · Lost &gt;3 months
        </p>
      </div>
    </Widget>
  )

  const needsAttention = (
    <Widget title="Needs Attention" action={attentionDevices.length > 0 ? { label: 'View all', href: '/admin/devices' } : undefined}>
      {attentionDevices.length > 0 ? (
        <div className="divide-y divide-gray-800 -mx-4 -mb-4">
          {attentionDevices.map(d => {
            const tier = getHealth(d.last_seen)
            const meta = HEALTH_META[tier]
            return (
              <a key={d.device_id} href={`/admin/devices/${d.device_id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800 transition-colors">
                <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate">{cleanHostname(d.hostname) || 'Unknown'}</p>
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
        <p className="text-gray-500 text-sm">All devices are healthy.</p>
      )}
    </Widget>
  )

  const agentVersions = (
    <Widget title="Agent Versions" action={{ label: 'View all', href: '/admin/devices' }}>
      {outdatedCount === 0 ? (
        <p className="text-gray-500 text-sm">
          {totalDevices > 0 ? `All agents on v${AGENT_VERSION}.` : 'No devices enrolled yet.'}
        </p>
      ) : (
        <>
          <p className="text-xs text-gray-500 mb-3">
            {outdatedCount} {outdatedCount === 1 ? 'agent is' : 'agents are'} behind the latest (v{AGENT_VERSION}). Healthy agents auto-update within ~5 minutes.
          </p>
          <div className="divide-y divide-gray-800 -mx-4 -mb-4">
            {outdatedList.map(d => (
              <a key={d.device_id} href={`/admin/devices/${d.device_id}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-800 transition-colors">
                <span className="text-sm text-white truncate">{cleanHostname(d.hostname) || 'Unknown'}</span>
                <span className="text-xs font-mono text-yellow-400 bg-yellow-950 px-2 py-0.5 rounded-full shrink-0 ml-2 whitespace-nowrap">
                  {d.agent_version ?? 'unknown'} → {AGENT_VERSION}
                </span>
              </a>
            ))}
            {outdatedCount > outdatedList.length && (
              <p className="px-4 py-2.5 text-xs text-gray-500">+{outdatedCount - outdatedList.length} more</p>
            )}
          </div>
        </>
      )}
    </Widget>
  )

  const activityChart = (
    <Widget title="Activity — Last 14 days" action={{ label: 'View all', href: '/admin/monitor' }}>
      <ActivityChart days={activityDays} />
    </Widget>
  )

  const enforcement = (
    <Widget title="Enforcement — Last 24h">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-3xl font-bold text-red-400">{blockedToday}</p>
          <p className="text-xs text-gray-500 mt-1">Apps blocked</p>
        </div>
        <div>
          <p className="text-3xl font-bold text-blue-400">{accessedToday}</p>
          <p className="text-xs text-gray-500 mt-1">Granted apps accessed</p>
        </div>
      </div>
    </Widget>
  )

  const topBlockedWidget = (
    <Widget title="Top Blocked Apps — 24h" action={{ label: 'View all', href: '/admin/monitor' }}>
      {topBlocked.length > 0 ? (
        <div className="divide-y divide-gray-800 -mx-4 -mb-4">
          {topBlocked.map(([name, count]) => (
            <div key={name} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-white">{name}</span>
              <span className="text-xs font-semibold text-red-400 bg-red-950 px-2 py-0.5 rounded-full">{count}×</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-sm">No blocks in the last 24 hours.</p>
      )}
    </Widget>
  )

  const recentActivity = (
    <Widget title="Recent Activity" action={{ label: 'View all', href: '/admin/monitor' }}>
      {recentLogs && recentLogs.length > 0 ? (
        <div className="divide-y divide-gray-800 -mx-4 -mb-4">
          {recentLogs.map((log, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
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
        <p className="text-gray-500 text-sm">No activity yet.</p>
      )}
    </Widget>
  )

  const unenrolledOrgsWidget = (
    <Widget title="Orgs Not Enrolled" action={{ label: 'View all', href: '/admin/orgs' }}>
      {unenrolledOrgs.length > 0 ? (
        <div className="divide-y divide-gray-800 -mx-4 -mb-4">
          {unenrolledOrgs.slice(0, 5).map(org => (
            <a key={org.id} href={`/admin/orgs/${org.id}/install`} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-800 transition-colors">
              <span className="text-sm text-white truncate">{org.name}</span>
              <span className="text-xs text-yellow-400 bg-yellow-950 px-2 py-0.5 rounded-full shrink-0 ml-2">No devices</span>
            </a>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-sm">All orgs have enrolled devices.</p>
      )}
    </Widget>
  )

  const quickActions = (
    <Widget title="Quick Actions">
      <div className="grid grid-cols-2 gap-2">
        <QuickAction href="/admin/orgs"         label="Add Org" />
        <QuickAction href="/admin/users/invite"  label="Invite User" />
        <QuickAction href="/admin/new"           label="Add App" />
        <QuickAction href="/admin/orgs"          label="Install Agent" />
      </div>
    </Widget>
  )

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">Dashboard</h1>

      {/* Stat cards — always at top, not draggable */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Organizations"    value={orgs?.length ?? 0}    href="/admin/orgs"     />
        <StatCard label="Total Devices"    value={totalDevices}          href="/admin/devices"  />
        <StatCard label="Healthy"          value={tierCounts.healthy}    href="/admin/devices"  accent="green" />
        <StatCard label="Pending Requests" value={pendingCount ?? 0}     href="/admin/requests" accent={pendingCount ? 'yellow' : undefined} />
      </div>

      {/* Draggable widgets */}
      <DashboardLayout userId={profile.id} widgets={{
        agentHealth:    agentHealth,
        needsAttention: needsAttention,
        agentVersions:  agentVersions,
        activityChart:  activityChart,
        enforcement:    enforcement,
        topBlocked:     topBlockedWidget,
        recentActivity: recentActivity,
        unenrolledOrgs: unenrolledOrgsWidget,
        quickActions:   quickActions,
      }} />
    </div>
  )
}

function Widget({ title, action, children }: {
  title: string
  action?: { label: string; href: string }
  children: React.ReactNode
}) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{title}</h2>
        {action && <a href={action.href} className="text-xs text-blue-400 hover:text-blue-300">{action.label}</a>}
      </div>
      {children}
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
    <a href={href} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-300 hover:text-white hover:border-gray-600 hover:bg-gray-700 transition-colors text-center block">
      {label}
    </a>
  )
}
