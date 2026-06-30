import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getCallerProfile, isMspStaff } from '@/lib/rbac'
import InviteForm from './InviteForm'

export default async function InviteUserPage() {
  const supabase = await createClient()
  const profile = await getCallerProfile(supabase)
  if (!profile) redirect('/login')
  if (!isMspStaff(profile)) redirect('/')

  const { data: orgs } = await supabase.from('orgs').select('id, name').order('name')

  return (
    <div className="p-6 max-w-lg mx-auto">
      <a href="/admin/users" className="text-gray-500 hover:text-gray-300 text-sm">← Back to Users</a>
      <h1 className="text-2xl font-bold text-white mt-4 mb-6">Invite User</h1>
      <InviteForm orgs={orgs ?? []} />
    </div>
  )
}
