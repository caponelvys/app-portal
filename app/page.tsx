import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getAppLogoUrl } from '@/lib/appLogos'
import { isGrantActive, expiresInLabel } from '@/lib/durations'
import RequestAccess, { type RequestableApp } from './RequestAccess'

type App = {
  id: string
  name: string
  description: string
  url: string
  icon: string
  icon_url: string | null
  status: string
}

type Grant = { expires_at: string | null }

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

  const { data: allowedApps } = await supabase
    .from('apps')
    .select('id, name, description, url, icon, icon_url, status')
    .eq('status', 'allowed')
    .order('name')

  const { data: blockedApps } = await supabase
    .from('apps')
    .select('id, name, description, url, icon, icon_url, status')
    .eq('status', 'blocked')
    .order('name')

  const { data: myRequests } = await supabase
    .from('app_requests')
    .select('app_id, status, expires_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Most recent request per app (rows are already newest-first).
  const latestByApp = new Map<string, { status: string; expires_at: string | null }>()
  for (const r of myRequests ?? []) {
    if (!latestByApp.has(r.app_id)) latestByApp.set(r.app_id, { status: r.status, expires_at: r.expires_at })
  }

  // Blocked apps the user currently has an active grant for show up as usable.
  const grantedApps: (App & { grant: Grant })[] = []
  const requestable: RequestableApp[] = []
  for (const app of (blockedApps ?? []) as App[]) {
    const req = latestByApp.get(app.id)
    if (req && isGrantActive(req.status, req.expires_at)) {
      grantedApps.push({ ...app, grant: { expires_at: req.expires_at } })
    } else {
      let requestStatus: RequestableApp['requestStatus'] = 'none'
      if (req?.status === 'pending') requestStatus = 'pending'
      else if (req?.status === 'denied') requestStatus = 'denied'
      else if (req?.status === 'expired' || (req?.status === 'approved')) requestStatus = 'expired'

      requestable.push({
        id: app.id,
        name: app.name,
        description: app.description,
        icon_url: app.icon_url,
        requestStatus,
      })
    }
  }

  const yourApps = [
    ...((allowedApps ?? []) as App[]).map(a => ({ app: a, grant: null as Grant | null })),
    ...grantedApps.map(a => ({ app: a as App, grant: a.grant })),
  ]

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">App Portal</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400 hidden sm:block truncate max-w-[200px]">{user.email}</span>
          <a href="/devices" className="text-sm text-gray-400 hover:text-gray-200 font-medium whitespace-nowrap">
            My Devices
          </a>
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

        {yourApps.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {yourApps.map(({ app, grant }) => (
              <a
                key={app.id}
                href={app.url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative bg-gray-900 rounded-xl p-5 border border-gray-800 hover:border-blue-500 hover:bg-gray-800 transition-all flex flex-col items-center text-center gap-3"
              >
                {grant && (
                  <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-900 text-blue-300 font-medium">
                    {expiresInLabel(grant.expires_at)}
                  </span>
                )}
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

        <RequestAccess apps={requestable} />
      </main>
    </div>
  )
}
