import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getCallerProfile, isMspStaff } from '@/lib/rbac'
import RequestsTable from './RequestsTable'

export default async function AdminRequestsPage() {
  const supabase = await createClient()

  const profile = await getCallerProfile(supabase)
  if (!profile) redirect('/login')
  if (!isMspStaff(profile)) redirect('/')

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/admin" className="text-gray-500 hover:text-gray-300 text-sm">← Apps</a>
          <h1 className="text-xl font-bold text-white">Access Requests</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400 hidden sm:block">{profile.role_v2}</span>
          <a href="/auth/signout" className="text-sm text-gray-400 hover:text-gray-200 underline">Sign out</a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <RequestsTable />
      </main>
    </div>
  )
}
