import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

type App = {
  id: string
  name: string
  description: string
  url: string
  icon: string
  icon_url: string | null
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  const { data: apps } = await supabase
    .from('apps')
    .select('id, name, description, url, icon, icon_url')
    .eq('status', 'allowed')
    .order('name')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">App Portal</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 hidden sm:block truncate max-w-[200px]">{user.email}</span>
          {isAdmin && (
            <a href="/admin" className="text-sm text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap">
              Admin
            </a>
          )}
          <a href="/auth/signout" className="text-sm text-gray-500 hover:text-gray-800 underline whitespace-nowrap">
            Sign out
          </a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-4 sm:mb-6">Your Apps</h2>

        {apps && apps.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {apps.map((app: App) => (
              <a
                key={app.id}
                href={app.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all flex flex-col items-center text-center gap-3"
              >
                {app.icon_url ? (
                  <img src={app.icon_url} alt={app.name} className="w-12 h-12 rounded-xl object-cover" />
                ) : (
                  <span className="text-4xl">{app.icon}</span>
                )}
                <div>
                  <p className="font-semibold text-gray-800">{app.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{app.description}</p>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No apps have been enabled yet. Check back later.</p>
        )}
      </main>
    </div>
  )
}
