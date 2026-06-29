import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import UsersTable from './UsersTable'

export default async function AdminUsersPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/')

  const { data: users } = await supabase
    .from('profiles')
    .select('id, email, role, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/admin" className="text-gray-500 hover:text-gray-300 text-sm">← Apps</a>
          <h1 className="text-xl font-bold text-white">Manage Users</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400 hidden sm:block">{user.email}</span>
          <a href="/auth/signout" className="text-sm text-gray-400 hover:text-gray-200 underline">Sign out</a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-white">All Users</h2>
          <a href="/admin/users/invite" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
            + Invite User
          </a>
        </div>
        <UsersTable users={users ?? []} currentUserId={user.id} />
      </main>
    </div>
  )
}
