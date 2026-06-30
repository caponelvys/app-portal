import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'
import DevicesTabs from './DevicesTabs'

export default async function AdminDevicesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const supabase = await createClient()

  const profile = await getCallerProfile(supabase)
  if (!profile) redirect('/login')
  if (!isMspStaff(profile)) redirect('/')

  const orgIds = await getAccessibleOrgIds(supabase, profile)

  let devQ = supabase.from('devices').select('*').order('last_seen', { ascending: false })
  if (orgIds !== null) devQ = devQ.in('org_id', orgIds.length ? orgIds : ['00000000-0000-0000-0000-000000000000'])

  const { data: devices } = await devQ

  const { data: logs } = await supabase
    .from('agent_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  const { tab } = await searchParams
  const defaultTab = tab === 'activity' ? 'activity' : tab === 'install' ? 'install' : 'devices'

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <DevicesTabs devices={devices ?? []} logs={logs ?? []} defaultTab={defaultTab} />
    </div>
  )
}
