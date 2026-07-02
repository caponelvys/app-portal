import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getCallerProfile, isMspStaff } from '@/lib/rbac'
import { cleanHostname } from '@/lib/hostname'
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

  // Only resolve hostnames for the devices actually referenced by these logs,
  // so this doesn't load (and silently truncate) the whole devices table.
  const deviceIds = [...new Set((logs ?? []).map(l => l.device_id).filter(Boolean))]
  const { data: devices } = deviceIds.length
    ? await supabase.from('devices').select('device_id, hostname').in('device_id', deviceIds)
    : { data: [] }

  const hostnameById = Object.fromEntries((devices ?? []).map(d => [d.device_id, cleanHostname(d.hostname) || d.device_id]))

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Monitor</h1>
      <ActivityTable logs={logs ?? []} hostnameById={hostnameById} userId={profile.id} />
    </div>
  )
}
