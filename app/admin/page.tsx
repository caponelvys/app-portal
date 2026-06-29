import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AdminAppsTable from './AdminAppsTable'

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/')

  const { data: apps } = await supabase
    .from('apps')
    .select('*')
    .order('name')

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="text-gray-500 hover:text-gray-300 text-sm">← Portal</a>
          <h1 className="text-lg sm:text-xl font-bold text-white">Admin</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400 hidden sm:block truncate max-w-[200px]">{user.email}</span>
          <a href="/auth/signout" className="text-sm text-gray-400 hover:text-gray-200 underline whitespace-nowrap">
            Sign out
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h2 className="text-xl sm:text-2xl font-semibold text-white">All Apps</h2>
          <div className="flex flex-wrap gap-2">
            <a href="/admin/devices" className="bg-gray-800 text-gray-200 border border-gray-700 px-4 py-2 rounded-lg hover:bg-gray-700 text-sm font-medium">
              Devices
            </a>
            <a href="/admin/users" className="bg-gray-800 text-gray-200 border border-gray-700 px-4 py-2 rounded-lg hover:bg-gray-700 text-sm font-medium">
              Manage Users
            </a>
            <a href="/admin/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
              + Add App
            </a>
          </div>
        </div>

        <AdminAppsTable apps={apps ?? []} />
      </main>
    </div>
  )
}
