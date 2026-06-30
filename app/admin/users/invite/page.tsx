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
    <div className="min-h-screen bg-gray-950">
      <header className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-4">
        <a href="/admin/users" className="text-gray-500 hover:text-gray-300 text-sm">← Back to Users</a>
      </header>

      <main className="max-w-lg mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <h1 className="text-2xl font-bold text-white mb-6">Invite User</h1>
        <InviteForm orgs={orgs ?? []} />
      </main>
    </div>
  )
}
