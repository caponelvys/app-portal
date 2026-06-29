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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/admin" className="text-gray-400 hover:text-gray-600 text-sm">← Apps</a>
          <h1 className="text-xl font-bold text-gray-800">Admin — Manage Users</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user.email}</span>
          <a href="/auth/signout" className="text-sm text-gray-500 hover:text-gray-800 underline">
            Sign out
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6">All Users</h2>
        <UsersTable users={users ?? []} currentUserId={user.id} />
      </main>
    </div>
  )
}
