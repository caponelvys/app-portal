import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getCallerProfile, isMspStaff } from '@/lib/rbac'
import TwoFactorSetup from './TwoFactorSetup'

export default async function SecurityPage() {
  const supabase = await createClient()
  const profile = await getCallerProfile(supabase)
  if (!profile) redirect('/login')

  const required = isMspStaff(profile)

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="text-gray-500 hover:text-gray-300 text-sm">← Portal</a>
          <h1 className="text-xl font-bold text-white">Security</h1>
        </div>
        <a href="/auth/signout" className="text-sm text-gray-400 hover:text-gray-200 underline">Sign out</a>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <p className="text-sm text-gray-500 mb-6">
          Add two-factor authentication to protect your account with a second step at sign-in.
        </p>
        <TwoFactorSetup required={required} />
      </main>
    </div>
  )
}
