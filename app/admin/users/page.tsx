import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getCallerProfile, isMspStaff } from '@/lib/rbac'
import UsersTable from './UsersTable'
import PendingInvites from './PendingInvites'

export default async function AdminUsersPage() {
  const supabase = await createClient()

  const callerProfile = await getCallerProfile(supabase)
  if (!callerProfile) redirect('/login')
  if (!isMspStaff(callerProfile)) redirect('/')

  const { data: rawUsers } = await supabase
    .from('profiles')
    .select('id, email, role, role_v2, org_id, created_at')
    .order('created_at', { ascending: false })

  const orgIds = [...new Set((rawUsers ?? []).map(u => u.org_id).filter(Boolean))]
  const { data: orgs } = orgIds.length
    ? await supabase.from('orgs').select('id, name').in('id', orgIds)
    : { data: [] }
  const orgName = new Map((orgs ?? []).map(o => [o.id, o.name]))

  const users = (rawUsers ?? []).map(u => ({ ...u, org_name: u.org_id ? (orgName.get(u.org_id) ?? null) : null }))

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/admin" className="text-gray-500 hover:text-gray-300 text-sm">← Apps</a>
          <h1 className="text-xl font-bold text-white">Manage Users</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400 hidden sm:block">{callerProfile.role_v2}</span>
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
        <PendingInvites />
        <UsersTable users={users ?? []} currentUserId={callerProfile.id} />
      </main>
    </div>
  )
}
