import { createClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import { isOnline } from '@/lib/deviceStatus'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'
import CreateForm from '../CreateForm'
import Breadcrumbs from '@/app/admin/Breadcrumbs'

export default async function OrgDetailPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  const supabase = await createClient()

  const profile = await getCallerProfile(supabase)
  if (!profile) redirect('/login')

  const orgIds = await getAccessibleOrgIds(supabase, profile)
  if (orgIds !== null && !orgIds.includes(orgId)) redirect('/admin/orgs')

  const { data: org } = await supabase.from('orgs').select('id, name').eq('id', orgId).single()
  if (!org) notFound()

  const [{ data: locations }, { data: devices }] = await Promise.all([
    supabase.from('locations').select('id, name').eq('org_id', orgId).order('name'),
    supabase.from('devices').select('location_id, last_seen').eq('org_id', orgId),
  ])

  const devCount = new Map<string, number>()
  const onlineCount = new Map<string, number>()
  for (const d of devices ?? []) {
    if (!d.location_id) continue
    devCount.set(d.location_id, (devCount.get(d.location_id) ?? 0) + 1)
    if (isOnline(d.last_seen)) onlineCount.set(d.location_id, (onlineCount.get(d.location_id) ?? 0) + 1)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Breadcrumbs items={[{ label: 'Clients', href: '/admin/orgs' }, { label: org.name }]} />
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h2 className="text-2xl font-semibold text-white">Locations</h2>
          <div className="flex items-center gap-2">
            <a href={`/admin/orgs/${org.id}/policies`} className="bg-gray-800 text-gray-200 border border-gray-700 px-4 py-2 rounded-lg hover:bg-gray-700 text-sm font-medium">
              Policies
            </a>
            <CreateForm kind="location" orgId={org.id} label="+ Add Location" />
          </div>
        </div>

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
                  <span className="text-green-400">{onlineCount.get(loc.id) ?? 0} online</span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No locations yet. Add one to start enrolling devices.</p>
        )}
    </div>
  )
}

