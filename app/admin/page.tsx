import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AdminAppsTable from './AdminAppsTable'

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/')

  // Fetch ALL apps (admin sees everything)
  const { data: apps } = await supabase
    .from('apps')
    .select('*')
    .order('name')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/" className="text-gray-400 hover:text-gray-600 text-sm">← Portal</a>
          <h1 className="text-xl font-bold text-gray-800">Admin — Manage Apps</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user.email}</span>
          <a href="/auth/signout" className="text-sm text-gray-500 hover:text-gray-800 underline">
            Sign out
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-gray-800">All Apps</h2>
          <div className="flex gap-3">
            <a
              href="/admin/users"
              className="bg-white text-gray-700 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium"
            >
              Manage Users
            </a>
            <a
              href="/admin/new"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              + Add App
            </a>
          </div>
        </div>

        <AdminAppsTable apps={apps ?? []} />
      </main>
    </div>
  )
}
