import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import MyDevices from './MyDevices'

export default async function MyDevicesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-transparent">
      <header className="bg-gray-900/70 backdrop-blur border-b border-gray-800 px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="text-gray-500 hover:text-gray-300 text-sm">← Portal</a>
          <h1 className="text-xl font-bold text-white">My Devices</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400 hidden sm:block truncate max-w-[200px]">{user.email}</span>
          <a href="/auth/signout" className="text-sm text-gray-400 hover:text-gray-200 underline whitespace-nowrap">
            Sign out
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <MyDevices />
      </main>
    </div>
  )
}
