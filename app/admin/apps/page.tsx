import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getCallerProfile, isMspStaff } from '@/lib/rbac'
import AdminAppsTable from '../AdminAppsTable'

export default async function AdminAppsPage() {
  const supabase = await createClient()
  const profile = await getCallerProfile(supabase)
  if (!profile) redirect('/login')
  if (!isMspStaff(profile)) redirect('/')

  const { data: apps } = await supabase.from('apps').select('*').order('name')

  const { count: pendingRequests } = await supabase
    .from('app_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Apps</h1>
        <div className="flex items-center gap-2">
          <a href="/admin/requests" className="relative bg-gray-800 text-gray-200 border border-gray-700 px-4 py-2 rounded-lg hover:bg-gray-700 text-sm font-medium">
            Requests
            {pendingRequests ? (
              <span className="absolute -top-2 -right-2 bg-yellow-500 text-gray-900 text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
                {pendingRequests}
              </span>
            ) : null}
          </a>
          <a href="/admin/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
            + Add App
          </a>
        </div>
      </div>
      <AdminAppsTable apps={apps ?? []} userId={profile.id} />
    </div>
  )
}
