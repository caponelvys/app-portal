import Breadcrumbs from '@/app/admin/Breadcrumbs'
import { createClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase-admin'
import { getHealthTier, TIER_LABEL, TIER_COLOR, TIER_DOT } from '@/lib/deviceStatus'
import { isGrantActive, expiresInLabel } from '@/lib/durations'
import { cleanHostname } from '@/lib/hostname'
import OwnerSuggestion from './OwnerSuggestion'
import DeviceActionsMenu from '../DeviceActionsMenu'
import AppCommand from '@/app/admin/AppCommand'
import { agentEventLabel, LEVEL_DOT } from '@/lib/agentEvents'
import { cleanPublisher } from '@/lib/software'
import EnforcementModeToggle from '@/app/admin/EnforcementModeToggle'
import RemovableStorageToggle from '@/app/admin/RemovableStorageToggle'
import RingSelector from './RingSelector'
import ElevateApp from './ElevateApp'

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

export default async function DeviceDetailPage({ params }: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const { data: device } = await supabase
    .from('devices')
    .select('device_id, hostname, os, last_seen, user_id, org_id, location_id, pairing_code, device_user, agent_version, ip_address, last_inventory_at, enforcement_mode, ring_id, removable_storage')
    .eq('device_id', deviceId)
    .single()
  if (!device) notFound()

  const [{ data: org }, { data: location }, { data: owner }, { data: logs }, { data: appCatalog }] = await Promise.all([
    device.org_id ? supabase.from('orgs').select('id, name, enforcement_mode, removable_storage').eq('id', device.org_id).single() : Promise.resolve({ data: null }),
    device.location_id ? supabase.from('locations').select('id, name, enforcement_mode, removable_storage').eq('id', device.location_id).single() : Promise.resolve({ data: null }),
    device.user_id ? supabase.from('profiles').select('email').eq('id', device.user_id).single() : Promise.resolve({ data: null }),
    supabase.from('agent_logs').select('app_name, action, created_at').eq('device_id', deviceId).order('created_at', { ascending: false }).limit(50),
    supabase.from('apps').select('id, name').order('name'),
  ])

  const { data: elevatableApps } = await supabase
    .from('apps').select('id, name').eq('allow_elevation', true).order('name')

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

  // Installed-software inventory (agent-written, RLS anon-only) via the
  // service-role client. Bounded to one device, so read the whole list.
  const { data: software } = await createAdminClient()
    .from('device_software')
    .select('name, version, publisher, sha256')
    .eq('device_id', deviceId)
    .order('name')

  // Rollout rings available for this device's org (for the ring selector).
  const { data: orgRings } = device.org_id
    ? await createAdminClient().from('rings').select('id, name, removable_storage').eq('org_id', device.org_id).order('position')
    : { data: [] }

  const activity: Activity[] = [
    ...(events ?? []).map(e => ({
      time: e.created_at,
      level: (['info', 'warn', 'error'].includes(e.level) ? e.level : 'info') as Activity['level'],
      label: agentEventLabel(e.event),
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

  const tier = getHealthTier(device.last_seen)

  // Effective enforcement mode mirrors the agent's resolver: device > location
  // > org > 'enforce'. Used for the inherit hint on the device toggle.
  const effectiveMode: 'enforce' | 'learn' =
    (device.enforcement_mode ?? location?.enforcement_mode ?? org?.enforcement_mode ?? 'enforce') === 'learn'
      ? 'learn' : 'enforce'

  // Effective removable-storage policy mirrors the agent resolver:
  // device > ring > location > org > allow.
  const deviceRing = (orgRings ?? []).find(r => r.id === device.ring_id)
  const effectiveUsb: 'allow' | 'block' =
    (device.removable_storage ?? deviceRing?.removable_storage ?? location?.removable_storage ?? org?.removable_storage ?? 'allow') === 'block'
      ? 'block' : 'allow'

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
              <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${TIER_COLOR[tier]}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${TIER_DOT[tier]}`} />
                {TIER_LABEL[tier]}
              </span>
              <DeviceActionsMenu
                deviceId={device.device_id}
                hostname={cleanHostname(device.hostname) || device.device_id}
                hasOwner={!!device.user_id}
              />
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 mt-4 text-sm">
            <Field label="OS" value={device.os} />
            <Field label="Device user" value={device.device_user ?? '—'} />
            <Field label="Agent version" value={device.agent_version ?? '—'} mono />
            <Field label="IP address" value={device.ip_address ?? '—'} mono />
            <Field label="Owner" value={owner?.email ?? (device.pairing_code ? `Unclaimed (code ${device.pairing_code})` : 'Unclaimed')} />
            <Field label="Last seen" value={device.last_seen ? new Date(device.last_seen).toLocaleString() : '—'} />
            <Field label="Device ID" value={device.device_id} mono />
          </dl>
          {ownerSuggestion && device.device_user && (
            <OwnerSuggestion deviceId={device.device_id} osUser={device.device_user} suggestion={ownerSuggestion} />
          )}
        </section>

        <section>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-lg font-semibold text-white">Enforcement</h2>
            {effectiveMode === 'learn' && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Learn mode
              </span>
            )}
          </div>
          <p className="text-gray-500 text-sm mb-3">
            In <span className="text-amber-300">Learn</span> mode this device is observed but blocked apps are recorded, not closed.
          </p>
          <EnforcementModeToggle
            scope="device"
            scopeId={device.device_id}
            current={(device.enforcement_mode as 'enforce' | 'learn' | null) ?? null}
            effective={effectiveMode}
          />
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-300 mb-1.5">Rollout ring</h3>
            <RingSelector
              deviceId={device.device_id}
              current={(device.ring_id as string | null) ?? null}
              rings={(orgRings ?? []).map(r => ({ id: r.id, name: r.name }))}
            />
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-300 mb-1.5">Removable storage</h3>
            <RemovableStorageToggle
              scope="device"
              scopeId={device.device_id}
              current={(device.removable_storage as 'allow' | 'block' | null) ?? null}
              effective={effectiveUsb}
            />
          </div>
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
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">
              Installed software
              {software && software.length > 0 && (
                <span className="text-gray-500 text-sm font-normal"> ({software.length})</span>
              )}
            </h2>
            {device.last_inventory_at && (
              <span className="text-xs text-gray-500">
                as of {new Date(device.last_inventory_at).toLocaleString()}
              </span>
            )}
          </div>
          {software && software.length > 0 ? (
            <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800 max-h-96 overflow-y-auto">
              {software.map((s, i) => {
                const publisher = cleanPublisher(s.publisher)
                return (
                <div key={i} className="flex items-baseline justify-between gap-3 px-4 py-2">
                  <p className="text-sm text-white min-w-0 truncate">
                    {s.name}
                    {publisher && <span className="text-gray-500"> — {publisher}</span>}
                  </p>
                  <div className="flex items-baseline gap-3 shrink-0">
                    {s.sha256 && (
                      <span className="text-[11px] text-gray-600 font-mono" title={s.sha256}>{s.sha256.slice(0, 12)}</span>
                    )}
                    <span className="text-xs text-gray-400 font-mono whitespace-nowrap">
                      {s.version || '—'}
                    </span>
                  </div>
                </div>
                )
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">
              {device.last_inventory_at
                ? 'No software reported.'
                : 'Inventory not yet reported by this device (needs agent v1.7.17+).'}
            </p>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-1">Manage apps</h2>
          <p className="text-gray-500 text-sm mb-3">Install or uninstall a managed app on this device. The result appears in Activity below.</p>
          <div className="space-y-3">
            <AppCommand apps={appCatalog ?? []} action="install" scope="device" scopeId={device.device_id} targetLabel={cleanHostname(device.hostname) || device.device_id} />
            <AppCommand apps={appCatalog ?? []} action="uninstall" scope="device" scopeId={device.device_id} targetLabel={cleanHostname(device.hostname) || device.device_id} />
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-1">Run elevated</h2>
          <p className="text-gray-500 text-sm mb-3">Launch an elevation-approved app with elevated privileges on this device, without granting the user local admin.</p>
          <ElevateApp deviceId={device.device_id} apps={elevatableApps ?? []} />
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
