import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { redirect } from 'next/navigation'
import { getCallerProfile, isMspStaff } from '@/lib/rbac'
import { resolveDeviceNames } from '@/lib/deviceArchive'
import ActivityTable from './ActivityTable'

export default async function MonitorPage() {
  const supabase = await createClient()

  const profile = await getCallerProfile(supabase)
  if (!profile) redirect('/login')
  if (!isMspStaff(profile)) redirect('/')

  const { data: logs } = await supabase
    .from('agent_logs')
    .select('id, device_id, app_name, action, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  // Resolve names only for the devices referenced by these logs (from the live
  // table + the archive, so deleted devices still show their name, not a UUID).
  const hostnameById = await resolveDeviceNames(createAdminClient(), (logs ?? []).map(l => l.device_id))

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Monitor</h1>
      <ActivityTable logs={logs ?? []} hostnameById={hostnameById} userId={profile.id} />
    </div>
  )
}
