import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { redirect } from 'next/navigation'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'
import { cleanHostname } from '@/lib/hostname'
import PolicyHistoryTable from './PolicyHistoryTable'

const NO_MATCH = '00000000-0000-0000-0000-000000000000'

export default async function PolicyHistoryPage() {
  const supabase = await createClient()
  const profile = await getCallerProfile(supabase)
  if (!profile) redirect('/login')
  if (!isMspStaff(profile)) redirect('/')

  const orgIds = await getAccessibleOrgIds(supabase, profile)
  const scopeIds = orgIds !== null ? (orgIds.length ? orgIds : [NO_MATCH]) : null

  const admin = createAdminClient()
  let q = admin.from('policy_changes').select('*').order('created_at', { ascending: false }).limit(100)
  if (scopeIds) q = q.in('org_id', scopeIds)
  const { data: changes } = await q

  const rows = changes ?? []
  // Batch-resolve the names referenced by the change rows.
  const appIds = [...new Set(rows.map(r => r.app_id).filter(Boolean))]
  const byType = (t: string) => [...new Set(rows.filter(r => r.scope_type === t).map(r => r.scope_id))]
  const actorIds = [...new Set(rows.map(r => r.changed_by).filter(Boolean))]

  const [{ data: apps }, { data: orgs }, { data: locs }, { data: devs }, { data: rings }, { data: profiles }] = await Promise.all([
    appIds.length ? admin.from('apps').select('id, name').in('id', appIds) : Promise.resolve({ data: [] }),
    byType('org').length ? admin.from('orgs').select('id, name').in('id', byType('org')) : Promise.resolve({ data: [] }),
    byType('location').length ? admin.from('locations').select('id, name').in('id', byType('location')) : Promise.resolve({ data: [] }),
    byType('device').length ? admin.from('devices').select('device_id, hostname').in('device_id', byType('device')) : Promise.resolve({ data: [] }),
    byType('ring').length ? admin.from('rings').select('id, name').in('id', byType('ring')) : Promise.resolve({ data: [] }),
    actorIds.length ? admin.from('profiles').select('id, email').in('id', actorIds) : Promise.resolve({ data: [] }),
  ])

  const appName = new Map((apps ?? []).map(a => [a.id, a.name]))
  const nameByScope: Record<string, Map<string, string>> = {
    org: new Map((orgs ?? []).map(o => [o.id, o.name])),
    location: new Map((locs ?? []).map(l => [l.id, l.name])),
    device: new Map((devs ?? []).map(d => [d.device_id, cleanHostname(d.hostname)])),
    ring: new Map((rings ?? []).map(r => [r.id, r.name])),
  }
  const email = new Map((profiles ?? []).map(p => [p.id, p.email]))

  const history = rows.map(r => ({
    id: r.id as string,
    app: appName.get(r.app_id) ?? 'Unknown app',
    scope_type: r.scope_type as string,
    scope_name: nameByScope[r.scope_type]?.get(r.scope_id) ?? 'Unknown',
    old_status: r.old_status as string | null,
    new_status: r.new_status as string | null,
    actor: email.get(r.changed_by) ?? 'System',
    at: r.created_at as string,
  }))

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Policy history</h1>
      <p className="text-gray-500 text-sm mb-6">
        Every allow/block change across org, location, device, and ring scopes. Revert a change to restore its prior value.
      </p>
      <PolicyHistoryTable history={history} />
    </div>
  )
}
