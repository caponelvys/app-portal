import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { redirect } from 'next/navigation'
import BrandLockup from './BrandLockup'
import PortalView, { type PortalApp, type PendingItem, type ExpiringItem, type ActiveItem } from './PortalView'

// A temporary grant counts as "expiring soon" once it's within this window.
const EXPIRING_SOON_MS = 3 * 24 * 60 * 60 * 1000

type AppRow = { id: string; name: string; description: string; url: string; icon_url: string | null; status: string }

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'

  const { data: apps } = await supabase
    .from('apps')
    .select('id, name, description, url, icon_url, status')
    .order('name')

  // Category is best-effort: the column ships in migration 0019, so tolerate its
  // absence (a null result just groups everything under "Other").
  const { data: cats } = await supabase.from('apps').select('id, category')
  const catById = new Map((cats ?? []).map((c: { id: string; category: string | null }) => [c.id, c.category]))

  // app_requests must be read with the service-role client — the authenticated
  // client returns empty/partial under RLS/grants (see HANDOFF gotcha), which
  // would drop every pending/active request and mis-bucket apps into Browse.
  const { data: myRequests } = await createAdminClient()
    .from('app_requests')
    .select('app_id, status, expires_at, duration, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Most recent request per app (rows are already newest-first).
  const latestByApp = new Map<string, { status: string; expires_at: string | null; duration: string; created_at: string }>()
  for (const r of myRequests ?? []) if (!latestByApp.has(r.app_id)) latestByApp.set(r.app_id, r)

  const pending: PendingItem[] = []
  const expiring: ExpiringItem[] = []
  const active: ActiveItem[] = []
  const catalog: PortalApp[] = []
  const now = Date.now()

  for (const a of (apps ?? []) as AppRow[]) {
    const app: PortalApp = {
      id: a.id, name: a.name, description: a.description, url: a.url,
      icon_url: a.icon_url, category: catById.get(a.id) ?? null,
    }
    const req = latestByApp.get(a.id)
    const grantActive = !!req && req.status === 'approved' && (!req.expires_at || new Date(req.expires_at).getTime() > now)

    if (a.status === 'allowed') {
      active.push({ app, expiresAt: null })
    } else if (a.status !== 'blocked') {
      continue  // ignore any non allowed/blocked status
    } else if (grantActive) {
      if (req!.expires_at && new Date(req!.expires_at).getTime() - now <= EXPIRING_SOON_MS) {
        expiring.push({ app, expiresAt: req!.expires_at, duration: req!.duration })
      } else {
        active.push({ app, expiresAt: req!.expires_at })
      }
    } else if (req && req.status === 'pending') {
      pending.push({ app, duration: req.duration, requestedAt: req.created_at })
    } else {
      catalog.push(app)  // none / denied / expired → requestable
    }
  }

  active.sort((x, y) => x.app.name.localeCompare(y.app.name))
  catalog.sort((x, y) => x.name.localeCompare(y.name))
  expiring.sort((x, y) => new Date(x.expiresAt).getTime() - new Date(y.expiresAt).getTime())

  return (
    <div className="min-h-screen bg-transparent">
      <header className="flex items-center justify-between border-b border-gray-800 bg-gray-900/70 px-4 py-4 backdrop-blur sm:px-6">
        <BrandLockup markSize={26} />
        <div className="flex items-center gap-3">
          <span className="hidden max-w-[200px] truncate text-sm text-gray-400 sm:block">{user.email}</span>
          <a href="/devices" className="whitespace-nowrap text-sm font-medium text-gray-400 hover:text-gray-200">My Devices</a>
          <a href="/account/security" className="whitespace-nowrap text-sm font-medium text-gray-400 hover:text-gray-200">Security</a>
          {isAdmin && <a href="/admin" className="whitespace-nowrap text-sm font-medium text-blue-400 hover:text-blue-300">Admin</a>}
          <a href="/auth/signout" className="whitespace-nowrap text-sm text-gray-400 underline hover:text-gray-200">Sign out</a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <PortalView pending={pending} expiring={expiring} active={active} catalog={catalog} />
      </main>
    </div>
  )
}
