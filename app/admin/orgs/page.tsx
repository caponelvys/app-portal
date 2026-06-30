import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { isOnline } from '@/lib/deviceStatus'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'
import CreateForm from './CreateForm'

export default async function OrgsPage() {
  const supabase = await createClient()

  const profile = await getCallerProfile(supabase)
  if (!profile) redirect('/login')
  if (!isMspStaff(profile)) redirect('/')

  const orgIds = await getAccessibleOrgIds(supabase, profile)

  let orgsQ = supabase.from('orgs').select('id, name').order('name')
  if (orgIds !== null) orgsQ = orgsQ.in('id', orgIds.length ? orgIds : ['00000000-0000-0000-0000-000000000000'])

  const [{ data: orgs }, { data: locations }, { data: devices }] = await Promise.all([
    orgsQ,
    supabase.from('locations').select('id, org_id'),
    supabase.from('devices').select('org_id, last_seen'),
  ])

  // Aggregate counts per org in one pass (DB rollup/RPC is the path for very
  // large fleets; this is fine for typical MSP sizes).
  const locCount = new Map<string, number>()
  for (const l of locations ?? []) locCount.set(l.org_id, (locCount.get(l.org_id) ?? 0) + 1)

  const devCount = new Map<string, number>()
  const onlineCount = new Map<string, number>()
  for (const d of devices ?? []) {
    if (!d.org_id) continue
    devCount.set(d.org_id, (devCount.get(d.org_id) ?? 0) + 1)
    if (isOnline(d.last_seen)) onlineCount.set(d.org_id, (onlineCount.get(d.org_id) ?? 0) + 1)
  }

  const totalDevices = devices?.length ?? 0
  const totalOnline = (devices ?? []).filter(d => isOnline(d.last_seen)).length

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/admin" className="text-gray-500 hover:text-gray-300 text-sm">← Admin</a>
          <h1 className="text-xl font-bold text-white">Clients</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400 hidden sm:block">{profile.role_v2}</span>
          <a href="/auth/signout" className="text-sm text-gray-400 hover:text-gray-200 underline">Sign out</a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex gap-6">
            <Stat label="Organizations" value={orgs?.length ?? 0} />
            <Stat label="Devices" value={totalDevices} />
            <Stat label="Online" value={totalOnline} accent />
          </div>
          <CreateForm kind="org" label="+ Add Organization" />
        </div>

        {orgs && orgs.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {orgs.map(org => (
              <a
                key={org.id}
                href={`/admin/orgs/${org.id}`}
                className="bg-gray-900 rounded-xl p-5 border border-gray-800 hover:border-blue-500 hover:bg-gray-800 transition-all"
              >
                <p className="font-semibold text-white text-lg mb-3">{org.name}</p>
                <div className="flex gap-4 text-sm text-gray-400">
                  <span>{locCount.get(org.id) ?? 0} locations</span>
                  <span>{devCount.get(org.id) ?? 0} devices</span>
                  <span className="text-green-400">{onlineCount.get(org.id) ?? 0} online</span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No organizations yet. Add your first client to get started.</p>
        )}
      </main>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div>
      <p className={`text-2xl font-bold ${accent ? 'text-green-400' : 'text-white'}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}
