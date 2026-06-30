import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'
import DevicesTabs from './DevicesTabs'

export default async function AdminDevicesPage() {
  const supabase = await createClient()

  const profile = await getCallerProfile(supabase)
  if (!profile) redirect('/login')
  if (!isMspStaff(profile)) redirect('/')

  const orgIds = await getAccessibleOrgIds(supabase, profile)

  let devQ = supabase
    .from('devices')
    .select('*, locations(name), orgs(name)')
    .order('last_seen', { ascending: false })
  if (orgIds !== null) devQ = devQ.in('org_id', orgIds.length ? orgIds : ['00000000-0000-0000-0000-000000000000'])

  const { data: devices } = await devQ

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">All Devices</h1>
      <DevicesTabs devices={devices ?? []} userId={profile.id} />
    </div>
  )
}
