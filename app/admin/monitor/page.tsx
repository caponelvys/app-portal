import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getCallerProfile, isMspStaff } from '@/lib/rbac'
import ActivityTable from './ActivityTable'

export default async function MonitorPage() {
  const supabase = await createClient()

  const profile = await getCallerProfile(supabase)
  if (!profile) redirect('/login')
  if (!isMspStaff(profile)) redirect('/')

  const [{ data: logs }, { data: devices }] = await Promise.all([
    supabase.from('agent_logs').select('id, device_id, app_name, action, created_at').order('created_at', { ascending: false }).limit(200),
    supabase.from('devices').select('device_id, hostname'),
  ])

  const hostnameById = Object.fromEntries((devices ?? []).map(d => [d.device_id, (d.hostname ?? '').split('.')[0] || d.hostname]))

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Monitor</h1>
      <ActivityTable logs={logs ?? []} hostnameById={hostnameById} userId={profile.id} />
    </div>
  )
}
