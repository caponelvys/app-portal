import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { redirect } from 'next/navigation'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'
import { HEALTHY_MS, INACTIVE_MS, WARNING_MS, STALE_MS } from '@/lib/deviceStatus'
import { parseTableState, timeRangeSince, DEFAULT_PAGE_SIZE } from '@/lib/tableParams'
import DevicesTableServer from './DevicesTableServer'

const NO_MATCH = '00000000-0000-0000-0000-000000000000'
const PAGE_SIZE = DEFAULT_PAGE_SIZE

// Direct device columns a sort id maps to; org/location sort by their joined
// name, status sorts by last_seen (its tier proxy).
const SORT_COLUMN: Record<string, string> = {
  hostname: 'hostname', os: 'os', status: 'last_seen',
  agentVersion: 'agent_version', ipAddress: 'ip_address', lastSeen: 'last_seen',
}

// Server equivalent of getHealthTier: last_seen bounds (ms ago) per tier.
const tierAgo = (ms: number) => new Date(Date.now() - ms).toISOString()

export default async function AdminDevicesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const supabase = await createClient()
  const profile = await getCallerProfile(supabase)
  if (!profile) redirect('/login')
  if (!isMspStaff(profile)) redirect('/')

  const orgIds = await getAccessibleOrgIds(supabase, profile)
  const scoped = orgIds !== null
  const scopeIds = scoped ? (orgIds!.length ? orgIds! : [NO_MATCH]) : null

  const state = parseTableState(await searchParams)
  const f = state.filters
  const from = (state.page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  // ── Page of devices (DB filter/sort/paginate + exact count) ────────────────
  let q = supabase.from('devices').select('*, locations(name), orgs(name)', { count: 'exact' })
  if (scopeIds) q = q.in('org_id', scopeIds)
  if (f.hostname) q = q.ilike('hostname', `%${f.hostname}%`)
  if (f.os) q = q.ilike('os', `%${f.os}%`)
  if (f.org) q = q.eq('org_id', f.org)
  if (f.location) q = q.eq('location_id', f.location)
  if (f.agentVersion) q = f.agentVersion === 'unknown' ? q.is('agent_version', null) : q.eq('agent_version', f.agentVersion)
  switch (f.status) {
    case 'never':    q = q.is('last_seen', null); break
    case 'healthy':  q = q.gte('last_seen', tierAgo(HEALTHY_MS)); break
    case 'inactive': q = q.gte('last_seen', tierAgo(INACTIVE_MS)).lt('last_seen', tierAgo(HEALTHY_MS)); break
    case 'warning':  q = q.gte('last_seen', tierAgo(WARNING_MS)).lt('last_seen', tierAgo(INACTIVE_MS)); break
    case 'stale':    q = q.gte('last_seen', tierAgo(STALE_MS)).lt('last_seen', tierAgo(WARNING_MS)); break
    case 'lost':     q = q.not('last_seen', 'is', null).lt('last_seen', tierAgo(STALE_MS)); break
  }
  if (f.lastSeen) { const since = timeRangeSince(f.lastSeen); if (since) q = q.gte('last_seen', since) }

  const asc = state.dir === 'asc'
  if (state.sort && SORT_COLUMN[state.sort]) q = q.order(SORT_COLUMN[state.sort], { ascending: asc })
  else if (state.sort === 'org') q = q.order('name', { referencedTable: 'orgs', ascending: asc })
  else if (state.sort === 'location') q = q.order('name', { referencedTable: 'locations', ascending: asc })
  else q = q.order('last_seen', { ascending: false })

  const { data: devices, count } = await q.range(from, to)

  // ── Facet options (sourced independently of the current page) ──────────────
  let orgQ = supabase.from('orgs').select('id, name').order('name').limit(1000)
  if (scopeIds) orgQ = orgQ.in('id', scopeIds)
  let locQ = supabase.from('locations').select('id, name').order('name').limit(1000)
  if (scopeIds) locQ = locQ.in('org_id', scopeIds)
  const admin = createAdminClient()

  const [{ data: orgRows }, { data: locRows }, { data: verRows }] = await Promise.all([
    orgQ, locQ, admin.rpc('device_version_counts', { org_ids: orgIds }),
  ])

  const orgOptions = (orgRows ?? []).map(o => ({ label: o.name, value: o.id }))
  const locationOptions = (locRows ?? []).map(l => ({ label: l.name, value: l.id }))
  const versionOptions = ((verRows ?? []) as { agent_version: string; count: number }[])
    .sort((a, b) => b.agent_version.localeCompare(a.agent_version))
    .map(v => ({ label: v.agent_version === 'unknown' ? 'Unknown' : v.agent_version, value: v.agent_version }))

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">All Devices</h1>
      <DevicesTableServer
        devices={devices ?? []}
        total={count ?? 0}
        state={state}
        pageSize={PAGE_SIZE}
        userId={profile.id}
        orgOptions={orgOptions}
        locationOptions={locationOptions}
        versionOptions={versionOptions}
      />
    </div>
  )
}
