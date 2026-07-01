import Breadcrumbs from '@/app/admin/Breadcrumbs'
import { createClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase-admin'
import { isOnline } from '@/lib/deviceStatus'
import { isGrantActive, expiresInLabel } from '@/lib/durations'
import { cleanHostname } from '@/lib/hostname'
import OwnerSuggestion from './OwnerSuggestion'

// Suggest a portal account for an unclaimed device by matching the reported OS
// username against email local-parts. Exact/starts-with only (no weak
// substring), preferring a candidate in the device's org on ties.
function suggestOwner(
  osUser: string | null,
  profiles: { id: string; email: string; org_id: string | null }[],
  deviceOrgId: string | null,
): { id: string; email: string } | null {
  const u = (osUser ?? '').trim().toLowerCase()
  if (!u) return null
  let best: { id: string; email: string } | null = null
  let bestRank = 0
  for (const p of profiles) {
    const local = (p.email ?? '').split('@')[0].toLowerCase()
    if (!local) continue
    let rank = 0
    if (local === u) rank = 3
    else if (local.startsWith(u) || u.startsWith(local)) rank = 2
    else if (local.includes(u) || u.includes(local)) rank = 1
    if (rank > 0 && deviceOrgId && p.org_id === deviceOrgId) rank += 0.5
    if (rank > bestRank) { best = { id: p.id, email: p.email }; bestRank = rank }
  }
  return bestRank >= 2 ? best : null
}

type Activity = { time: string; level: 'info' | 'warn' | 'error'; label: string; detail: string }

const EVENT_LABEL: Record<string, string> = {
  started:       'Agent started',
  enrolled:      'Enrolled into location',
  enroll_failed: 'Enrollment failed',
  paired:        'Paired to user',
  pairing:       'Awaiting user pairing',
  update_applied:'Agent updated',
  update_failed: 'Agent update failed',
  error:         'Agent error',
}

const LEVEL_DOT: Record<Activity['level'], string> = {
  info:  'bg-gray-500',
  warn:  'bg-orange-400',
  error: 'bg-red-500',
}

export default async function DeviceDetailPage({ params }: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const { data: device } = await supabase
    .from('devices')
    .select('device_id, hostname, os, last_seen, user_id, org_id, location_id, pairing_code, device_user')
    .eq('device_id', deviceId)
    .single()
  if (!device) notFound()

  const [{ data: org }, { data: location }, { data: owner }, { data: logs }] = await Promise.all([
    device.org_id ? supabase.from('orgs').select('id, name').eq('id', device.org_id).single() : Promise.resolve({ data: null }),
    device.location_id ? supabase.from('locations').select('id, name').eq('id', device.location_id).single() : Promise.resolve({ data: null }),
    device.user_id ? supabase.from('profiles').select('email').eq('id', device.user_id).single() : Promise.resolve({ data: null }),
    supabase.from('agent_logs').select('app_name, action, created_at').eq('device_id', deviceId).order('created_at', { ascending: false }).limit(50),
  ])

  // Active grants belong to the device's owner (per-user model).
  let grants: { app_name: string; expires_at: string | null }[] = []
  if (device.user_id) {
    const { data: reqs } = await supabase
      .from('app_requests')
      .select('app_id, status, expires_at')
      .eq('user_id', device.user_id)
      .eq('status', 'approved')
    const active = (reqs ?? []).filter(r => isGrantActive(r.status, r.expires_at))
    if (active.length) {
      const { data: apps } = await supabase.from('apps').select('id, name').in('id', active.map(a => a.app_id))
      const nameById = new Map((apps ?? []).map(a => [a.id, a.name]))
      grants = active.map(a => ({ app_name: nameById.get(a.app_id) ?? 'Unknown app', expires_at: a.expires_at }))
    }
  }

  // agent_events (lifecycle/errors) is written by the agent with the anon key
  // and read here via the service-role client. Merge it with agent_logs
  // (enforcement) into one time-ordered activity feed.
  const { data: events } = await createAdminClient()
    .from('agent_events')
    .select('level, event, message, created_at')
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false })
    .limit(50)

  const activity: Activity[] = [
    ...(events ?? []).map(e => ({
      time: e.created_at,
      level: (['info', 'warn', 'error'].includes(e.level) ? e.level : 'info') as Activity['level'],
      label: EVENT_LABEL[e.event] ?? e.event,
      detail: e.message ?? '',
    })),
    ...(logs ?? []).map(l => ({
      time: l.created_at,
      level: (l.action === 'killed' ? 'warn' : 'info') as Activity['level'],
      label: l.action === 'accessed' ? 'Accessed app' : 'Blocked app',
      detail: l.app_name,
    })),
  ]
    .sort((a, b) => b.time.localeCompare(a.time))
    .slice(0, 60)

  // If the device is unclaimed but the agent reported an OS user, try to match
  // it to a portal account and suggest it as the owner.
  let ownerSuggestion: { id: string; email: string } | null = null
  if (!device.user_id && device.device_user) {
    const { data: candidates } = await createAdminClient()
      .from('profiles')
      .select('id, email, org_id')
      .limit(1000)
    ownerSuggestion = suggestOwner(device.device_user, candidates ?? [], device.org_id)
  }

  const online = isOnline(device.last_seen)

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <Breadcrumbs items={[
        { label: 'Organizations', href: '/admin/orgs' },
        ...(org ? [{ label: org.name, href: `/admin/orgs/${org.id}` }] : []),
        ...(location ? [{ label: location.name, href: `/admin/locations/${location.id}` }] : []),
        { label: cleanHostname(device.hostname) || 'Device' },
      ]} />
        <section className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">{cleanHostname(device.hostname) || 'Unknown device'}</h1>
            <div className="flex items-center gap-4">
              <a href={`/admin/devices/${device.device_id}/policies`} className="text-sm text-blue-400 hover:text-blue-300 font-medium">
                Policies
              </a>
              <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${online ? 'text-green-400' : 'text-gray-500'}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-green-400' : 'bg-gray-600'}`} />
                {online ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 mt-4 text-sm">
            <Field label="OS" value={device.os} />
            <Field label="Device user" value={device.device_user ?? '—'} />
            <Field label="Owner" value={owner?.email ?? (device.pairing_code ? `Unclaimed (code ${device.pairing_code})` : 'Unclaimed')} />
            <Field label="Last seen" value={device.last_seen ? new Date(device.last_seen).toLocaleString() : '—'} />
            <Field label="Device ID" value={device.device_id} mono />
          </dl>
          {ownerSuggestion && device.device_user && (
            <OwnerSuggestion deviceId={device.device_id} osUser={device.device_user} suggestion={ownerSuggestion} />
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">Active access</h2>
          {grants.length === 0 ? (
            <p className="text-gray-500 text-sm">No active grants for the device owner.</p>
          ) : (
            <div className="space-y-2">
              {grants.map((g, i) => (
                <div key={i} className="bg-gray-900 rounded-xl border border-gray-800 px-4 py-3 flex items-center justify-between">
                  <span className="text-white">{g.app_name}</span>
                  <span className="text-xs text-blue-300 bg-blue-950 px-2 py-0.5 rounded-full">{expiresInLabel(g.expires_at)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">Activity</h2>
            {activity.length > 0 && (
              <a
                href={`/api/devices/${device.device_id}/logs`}
                download
                className="text-xs text-gray-300 border border-gray-700 rounded-md px-3 py-1.5 hover:bg-gray-800 hover:border-gray-500 transition-colors"
              >
                Download logs
              </a>
            )}
          </div>
          {activity.length > 0 ? (
            <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
              {activity.map((a, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${LEVEL_DOT[a.level]}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white">
                      {a.label}
                      {a.detail && <span className="text-gray-400"> — {a.detail}</span>}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap shrink-0">{new Date(a.time).toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No activity recorded for this device.</p>
          )}
        </section>
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-gray-500 text-xs">{label}</dt>
      <dd className={`text-gray-200 ${mono ? 'font-mono text-xs break-all' : ''}`}>{value}</dd>
    </div>
  )
}
