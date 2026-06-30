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
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Organizations</h1>
          <div className="flex gap-6 mt-2">
            <Stat label="Organizations" value={orgs?.length ?? 0} />
            <Stat label="Devices" value={totalDevices} />
            <Stat label="Online" value={totalOnline} accent />
          </div>
        </div>
        <CreateForm kind="org" label="+ Add Organization" />
      </div>

      {orgs && orgs.length > 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-400">Organization</th>
                <th className="text-left px-4 py-3 font-medium text-gray-400">Locations</th>
                <th className="text-left px-4 py-3 font-medium text-gray-400">Devices</th>
                <th className="text-left px-4 py-3 font-medium text-gray-400">Online</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map(org => (
                <tr key={org.id} className="border-b border-gray-800 hover:bg-gray-800 transition-colors">
                  <td className="px-4 py-3">
                    <a href={`/admin/orgs/${org.id}`} className="text-blue-400 hover:text-blue-300 font-medium">
                      {org.name}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{locCount.get(org.id) ?? 0}</td>
                  <td className="px-4 py-3 text-gray-400">{devCount.get(org.id) ?? 0}</td>
                  <td className="px-4 py-3 text-green-400">{onlineCount.get(org.id) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-500">No organizations yet. Add your first client to get started.</p>
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
