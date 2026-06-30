import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getCallerProfile, isMspStaff } from '@/lib/rbac'
import AdminShell from './AdminShell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const profile = await getCallerProfile(supabase)
  if (!profile) redirect('/login')
  if (!isMspStaff(profile)) redirect('/')

  // 2FA is mandatory for MSP staff. nextLevel 'aal2' means a verified factor
  // exists; anything less means they haven't enrolled yet.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal?.nextLevel !== 'aal2') redirect('/account/security?required=1')

  return <AdminShell roleLabel={profile.role_v2}>{children}</AdminShell>
}
