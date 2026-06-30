import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { durationLabel } from '@/lib/durations'
import { getCallerProfile, isMspStaff } from '@/lib/rbac'
import ExportMenu from './ExportMenu'

type AuditEvent = {
  time: string
  kind: 'request' | 'approved' | 'denied' | 'revoked' | 'accessed' | 'killed'
  app: string
  actor: string
  detail: string
}

const KIND_STYLES: Record<AuditEvent['kind'], string> = {
  request: 'bg-yellow-900 text-yellow-400',
  approved: 'bg-green-950 text-green-400',
  denied: 'bg-red-950 text-red-400',
  revoked: 'bg-red-950 text-red-400',
  accessed: 'bg-blue-950 text-blue-300',
  killed: 'bg-gray-800 text-gray-400',
}

const KIND_LABELS: Record<AuditEvent['kind'], string> = {
  request: 'Requested',
  approved: 'Approved',
  denied: 'Denied',
  revoked: 'Revoked',
  accessed: 'Accessed',
  killed: 'Blocked',
}

export default async function AuditLogPage() {
  const supabase = await createClient()

  const profile = await getCallerProfile(supabase)
  if (!profile) redirect('/login')
  if (!isMspStaff(profile)) redirect('/')

  const [{ data: requests }, { data: logs }, { data: apps }, { data: profiles }, { data: devices }, { data: orgs }] =
    await Promise.all([
      supabase.from('app_requests').select('app_id, user_id, duration, status, created_at, reviewed_at, reviewed_by'),
      supabase.from('agent_logs').select('device_id, app_name, action, created_at').order('created_at', { ascending: false }).limit(300),
      supabase.from('apps').select('id, name'),
      supabase.from('profiles').select('id, email'),
      supabase.from('devices').select('device_id, hostname, user_id'),
      supabase.from('orgs').select('id, name').order('name'),
    ])

  const appName = new Map((apps ?? []).map(a => [a.id, a.name]))
  const email = new Map((profiles ?? []).map(p => [p.id, p.email]))
  const device = new Map((devices ?? []).map(d => [d.device_id, d]))

  const events: AuditEvent[] = []

  for (const r of requests ?? []) {
    const who = email.get(r.user_id) ?? 'Unknown user'
    const app = appName.get(r.app_id) ?? 'Unknown app'
    events.push({
      time: r.created_at,
      kind: 'request',
      app,
      actor: who,
      detail: `requested ${durationLabel(r.duration).toLowerCase()} access`,
    })
    if (r.reviewed_at && (r.status === 'approved' || r.status === 'denied' || r.status === 'revoked')) {
      const reviewer = (r.reviewed_by && email.get(r.reviewed_by)) || 'admin'
      events.push({
        time: r.reviewed_at,
        kind: r.status,
        app,
        actor: reviewer,
        detail: `${r.status} access for ${who}`,
      })
    }
  }

  for (const l of logs ?? []) {
    const dev = device.get(l.device_id)
    const who = (dev?.user_id && email.get(dev.user_id)) || dev?.hostname || 'Unknown device'
    const kind: AuditEvent['kind'] = l.action === 'accessed' ? 'accessed' : 'killed'
    events.push({
      time: l.created_at,
      kind,
      app: l.app_name,
      actor: who,
      detail: kind === 'accessed' ? `used on ${dev?.hostname ?? 'a device'}` : `blocked on ${dev?.hostname ?? 'a device'}`,
    })
  }

  events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
  const recent = events.slice(0, 200)

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/admin" className="text-gray-500 hover:text-gray-300 text-sm">← Apps</a>
          <h1 className="text-xl font-bold text-white">Audit Log</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400 hidden sm:block">{profile.role_v2}</span>
          <a href="/auth/signout" className="text-sm text-gray-400 hover:text-gray-200 underline">Sign out</a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            Who requested, approved, used, or was blocked from apps — most recent first.
          </p>
          <ExportMenu orgs={orgs ?? []} />
        </div>
        {recent.length === 0 ? (
          <p className="text-gray-500 text-sm">No activity yet.</p>
        ) : (
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-gray-800 border-b border-gray-700">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-400">When</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-400">Event</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-400">App</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-400">Who</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-400">Detail</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((e, i) => (
                  <tr key={i} className="border-b border-gray-800">
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{new Date(e.time).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${KIND_STYLES[e.kind]}`}>
                        {KIND_LABELS[e.kind]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white">{e.app}</td>
                    <td className="px-4 py-3 text-gray-300">{e.actor}</td>
                    <td className="px-4 py-3 text-gray-500">{e.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
