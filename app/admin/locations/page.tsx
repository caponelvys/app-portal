import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { redirect } from 'next/navigation'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'

const NO_MATCH = '00000000-0000-0000-0000-000000000000'

export default async function LocationsPage() {
  const supabase = await createClient()

  const profile = await getCallerProfile(supabase)
  if (!profile) redirect('/login')
  if (!isMspStaff(profile)) redirect('/')

  const orgIds = await getAccessibleOrgIds(supabase, profile)

  let locsQ = supabase.from('locations').select('id, name, org_id').order('name')
  let orgsQ = supabase.from('orgs').select('id, name')
  if (orgIds !== null) {
    const ids = orgIds.length ? orgIds : [NO_MATCH]
    locsQ = locsQ.in('org_id', ids)
    orgsQ = orgsQ.in('id', ids)
  }

  const [{ data: locations }, { data: orgs }, { data: counts }] = await Promise.all([
    locsQ,
    orgsQ,
    // Exact per-location device/healthy counts in one grouped query.
    createAdminClient().rpc('location_device_counts', { org_ids: orgIds }),
  ])

  const orgName = new Map((orgs ?? []).map(o => [o.id, o.name]))
  const devCount = new Map<string, number>()
  const healthyCount = new Map<string, number>()
  let totalDevices = 0
  let totalHealthy = 0
  for (const c of (counts ?? []) as { location_id: string; total: number; healthy: number }[]) {
    devCount.set(c.location_id, Number(c.total))
    healthyCount.set(c.location_id, Number(c.healthy))
    totalDevices += Number(c.total)
    totalHealthy += Number(c.healthy)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Locations</h1>
        <div className="flex gap-6 mt-2">
          <Stat label="Locations" value={locations?.length ?? 0} />
          <Stat label="Devices" value={totalDevices} />
          <Stat label="Healthy" value={totalHealthy} accent />
        </div>
      </div>

      {locations && locations.length > 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-400">Location</th>
                <th className="text-left px-4 py-3 font-medium text-gray-400">Organization</th>
                <th className="text-left px-4 py-3 font-medium text-gray-400">Devices</th>
                <th className="text-left px-4 py-3 font-medium text-gray-400">Healthy</th>
              </tr>
            </thead>
            <tbody>
              {locations.map(loc => (
                <tr key={loc.id} className="border-b border-gray-800 hover:bg-gray-800 transition-colors">
                  <td className="px-4 py-3">
                    <a href={`/admin/locations/${loc.id}`} className="text-blue-400 hover:text-blue-300 font-medium">
                      {loc.name}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    <a href={`/admin/orgs/${loc.org_id}`} className="hover:text-gray-200">{orgName.get(loc.org_id) ?? '—'}</a>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{devCount.get(loc.id) ?? 0}</td>
                  <td className="px-4 py-3 text-green-400">{healthyCount.get(loc.id) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-500">No locations yet. Add one from an organization to start enrolling devices.</p>
      )}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div>
      <p className={`text-lg font-bold ${accent ? 'text-green-400' : 'text-white'}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}
