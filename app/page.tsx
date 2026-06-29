import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getAppLogoUrl } from '@/lib/appLogos'

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
    <div className="min-h-screen bg-gray-950">
      <header className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">App Portal</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400 hidden sm:block truncate max-w-[200px]">{user.email}</span>
          {isAdmin && (
            <a href="/admin" className="text-sm text-blue-400 hover:text-blue-300 font-medium whitespace-nowrap">
              Admin
            </a>
          )}
          <a href="/auth/signout" className="text-sm text-gray-400 hover:text-gray-200 underline whitespace-nowrap">
            Sign out
          </a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <h2 className="text-xl sm:text-2xl font-semibold text-white mb-4 sm:mb-6">Your Apps</h2>

        {apps && apps.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {apps.map((app: App) => (
              <a
                key={app.id}
                href={app.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-900 rounded-xl p-5 border border-gray-800 hover:border-blue-500 hover:bg-gray-800 transition-all flex flex-col items-center text-center gap-3"
              >
                {getAppLogoUrl(app.name, app.icon_url) ? (
                  <img src={getAppLogoUrl(app.name, app.icon_url)!} alt={app.name} className="w-12 h-12 rounded-xl object-contain bg-white p-1" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center text-xl font-bold text-gray-400 border border-gray-700">
                    {app.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-white">{app.name}</p>
                  <p className="text-xs text-gray-400 mt-1">{app.description}</p>
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
