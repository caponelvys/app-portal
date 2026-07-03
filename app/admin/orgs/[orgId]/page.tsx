import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { redirect, notFound } from 'next/navigation'
import { TIER_LABEL, TIER_COLOR, TIER_DOT, type HealthTier } from '@/lib/deviceStatus'
import { getCallerProfile, getAccessibleOrgIds } from '@/lib/rbac'
import { AGENT_VERSION, isVersionBehind } from '@/lib/agentVersion'
import CreateForm from '../CreateForm'
import Breadcrumbs from '@/app/admin/Breadcrumbs'
import RenameForm from '@/app/admin/RenameForm'
import ActivityChart from '@/app/admin/ActivityChart'
import AppUninstall from '@/app/admin/AppUninstall'

const TIERS: HealthTier[] = ['healthy', 'inactive', 'warning', 'stale', 'lost', 'never']

export default async function OrgDetailPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  const supabase = await createClient()

  const profile = await getCallerProfile(supabase)
  if (!profile) redirect('/login')

  const orgIds = await getAccessibleOrgIds(supabase, profile)
  if (orgIds !== null && !orgIds.includes(orgId)) redirect('/admin/orgs')

  const { data: org } = await supabase.from('orgs').select('id, name').eq('id', orgId).single()
  if (!org) notFound()

  const admin = createAdminClient()
  const scope = [orgId]
  const [{ data: locations }, { data: healthRows }, { data: versionRows }, { data: locCountRows }, { data: idRows }, { data: appCatalog }] = await Promise.all([
    supabase.from('locations').select('id, name').eq('org_id', orgId).order('name'),
    admin.rpc('device_health_counts', { org_ids: scope }),
    admin.rpc('device_version_counts', { org_ids: scope }),
    admin.rpc('location_device_counts', { org_ids: scope }),
    // device_ids for scoping the activity chart's agent_logs query (ids only)
    admin.from('devices').select('device_id').eq('org_id', orgId).limit(5000),
    supabase.from('apps').select('id, name').order('name'),
  ])

  const tiers: Record<HealthTier, number> = { healthy: 0, inactive: 0, warning: 0, stale: 0, lost: 0, never: 0 }
  for (const r of (healthRows ?? []) as { tier: HealthTier; count: number }[]) tiers[r.tier] = Number(r.count)
  const totalDevices = Object.values(tiers).reduce((a, b) => a + b, 0)

  const devCount = new Map<string, number>()
  const healthyByLoc = new Map<string, number>()
  for (const c of (locCountRows ?? []) as { location_id: string; total: number; healthy: number }[]) {
    devCount.set(c.location_id, Number(c.total))
    healthyByLoc.set(c.location_id, Number(c.healthy))
  }

  const outdated = ((versionRows ?? []) as { agent_version: string; count: number }[])
    .filter(v => isVersionBehind(v.agent_version === 'unknown' ? null : v.agent_version))
    .reduce((sum, v) => sum + Number(v.count), 0)

  // 14-day activity for this org's devices.
  const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const deviceIds = ((idRows ?? []) as { device_id: string }[]).map(d => d.device_id)
  const { data: logs14d } = deviceIds.length
    ? await supabase.from('agent_logs').select('action, created_at').in('device_id', deviceIds).gte('created_at', since14d).limit(5000)
    : { data: [] }
  const activityDays = Array.from({ length: 14 }, (_, i) => {
    const dt = new Date(Date.now() - (13 - i) * 24 * 60 * 60 * 1000)
    return { key: dt.toISOString().slice(0, 10), label: `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}`, blocked: 0, accessed: 0 }
  })
  const dayByKey = new Map(activityDays.map(d => [d.key, d]))
  for (const l of logs14d ?? []) {
    const day = dayByKey.get((l.created_at as string).slice(0, 10))
    if (!day) continue
    if (l.action === 'killed') day.blocked++
    else if (l.action === 'accessed') day.accessed++
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Breadcrumbs items={[{ label: 'Organizations', href: '/admin/orgs' }, { label: org.name }]} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RenameForm kind="org" id={org.id} currentName={org.name} />
        <div className="flex items-center gap-2">
          <a href={`/admin/orgs/${org.id}/install`} className="bg-gray-800 text-gray-200 border border-gray-700 px-4 py-2 rounded-lg hover:bg-gray-700 text-sm font-medium">
            Install Agent
          </a>
          <a href={`/admin/orgs/${org.id}/policies`} className="bg-gray-800 text-gray-200 border border-gray-700 px-4 py-2 rounded-lg hover:bg-gray-700 text-sm font-medium">
            Policies
          </a>
          <CreateForm kind="location" orgId={org.id} label="+ Add Location" />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Locations" value={locations?.length ?? 0} />
        <Stat label="Devices" value={totalDevices} />
        <Stat label="Healthy" value={tiers.healthy} accent="green" />
        <Stat label="Outdated agents" value={outdated} accent={outdated ? 'yellow' : undefined} />
      </div>

      {/* Insight graphs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Agent Health">
          {totalDevices === 0 ? (
            <p className="text-gray-500 text-sm">No devices enrolled in this org yet.</p>
          ) : (
            <div className="space-y-4">
              {TIERS.map(tier => {
                const count = tiers[tier]
                const pct = totalDevices > 0 ? (count / totalDevices) * 100 : 0
                return (
                  <div key={tier}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${TIER_DOT[tier]}`} />
                        <span className="text-gray-300">{TIER_LABEL[tier]}</span>
                      </div>
                      <span className={`font-semibold ${count > 0 && tier !== 'healthy' ? TIER_COLOR[tier] : 'text-gray-400'}`}>{count}</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${TIER_DOT[tier]}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card title="Activity — Last 14 days" action={<a href="/admin/monitor" className="text-xs text-blue-400 hover:text-blue-300">View all</a>}>
          <ActivityChart days={activityDays} />
        </Card>
      </div>

      {/* Locations */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Locations</h2>
        {locations && locations.length > 0 ? (
          <div className="space-y-2">
            {locations.map(loc => (
              <a
                key={loc.id}
                href={`/admin/locations/${loc.id}`}
                className="bg-gray-900 rounded-xl border border-gray-800 px-4 py-3 flex items-center justify-between gap-3 hover:border-blue-500 hover:bg-gray-800 transition-all"
              >
                <p className="text-white font-medium">{loc.name}</p>
                <div className="flex gap-4 text-sm text-gray-400">
                  <span>{devCount.get(loc.id) ?? 0} devices</span>
                  <span className="text-green-400">{healthyByLoc.get(loc.id) ?? 0} healthy</span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No locations yet. Add one to start enrolling devices.</p>
        )}
      </div>

      {/* Mass app uninstall across the org */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Remove apps</h2>
        <p className="text-gray-500 text-sm mb-3">Uninstall a managed app from every device in {org.name}. Results appear in the Agent Monitor.</p>
        <AppUninstall apps={appCatalog ?? []} scope="org" scopeId={org.id} targetLabel={org.name} />
      </div>
    </div>
  )
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: 'green' | 'yellow' }) {
  const color = accent === 'green' ? 'text-green-400' : accent === 'yellow' && value > 0 ? 'text-yellow-400' : 'text-white'
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  )
}
