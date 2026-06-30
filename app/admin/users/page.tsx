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
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <a href="/admin/users/invite" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
          + Invite User
        </a>
      </div>
      <PendingInvites />
      <UsersTable users={users ?? []} currentUserId={callerProfile.id} />
    </div>
  )
}
