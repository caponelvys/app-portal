import { createClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import { isOnline } from '@/lib/deviceStatus'
import { isGrantActive, expiresInLabel } from '@/lib/durations'

export default async function DeviceDetailPage({ params }: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const { data: device } = await supabase
    .from('devices')
    .select('device_id, hostname, os, last_seen, user_id, org_id, location_id, pairing_code')
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

  const online = isOnline(device.last_seen)

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-4 flex items-center justify-between">
        <nav className="text-sm text-gray-400 flex items-center gap-2 flex-wrap">
          <a href="/admin/orgs" className="hover:text-gray-200">Clients</a>
          <span className="text-gray-600">/</span>
          {org && <><a href={`/admin/orgs/${org.id}`} className="hover:text-gray-200">{org.name}</a><span className="text-gray-600">/</span></>}
          {location && <><a href={`/admin/locations/${location.id}`} className="hover:text-gray-200">{location.name}</a><span className="text-gray-600">/</span></>}
          <span className="text-white font-semibold">{device.hostname || 'Device'}</span>
        </nav>
        <a href="/auth/signout" className="text-sm text-gray-400 hover:text-gray-200 underline">Sign out</a>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
        <section className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">{device.hostname || 'Unknown device'}</h1>
            <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${online ? 'text-green-400' : 'text-gray-500'}`}>
              <span className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-green-400' : 'bg-gray-600'}`} />
              {online ? 'Online' : 'Offline'}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-3 mt-4 text-sm">
            <Field label="OS" value={device.os} />
            <Field label="Owner" value={owner?.email ?? (device.pairing_code ? `Unclaimed (code ${device.pairing_code})` : 'Unclaimed')} />
            <Field label="Last seen" value={device.last_seen ? new Date(device.last_seen).toLocaleString() : '—'} />
            <Field label="Device ID" value={device.device_id} mono />
          </dl>
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
          <h2 className="text-lg font-semibold text-white mb-3">Recent activity</h2>
          {logs && logs.length > 0 ? (
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[420px]">
                <tbody>
                  {logs.map((l, i) => (
                    <tr key={i} className="border-b border-gray-800 last:border-0">
                      <td className="px-4 py-2.5 text-white">{l.app_name}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-medium ${l.action === 'accessed' ? 'text-blue-300' : 'text-gray-400'}`}>
                          {l.action === 'accessed' ? 'Accessed' : 'Blocked'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs text-right">{new Date(l.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No activity recorded for this device.</p>
          )}
        </section>
      </main>
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
