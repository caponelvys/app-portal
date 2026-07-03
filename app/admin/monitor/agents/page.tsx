import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { redirect } from 'next/navigation'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'
import { cleanHostname } from '@/lib/hostname'
import { getHealthTier, TIER_LABEL, INACTIVE_MS } from '@/lib/deviceStatus'
import { AGENT_VERSION, isVersionBehind } from '@/lib/agentVersion'
import { agentEventLabel } from '@/lib/agentEvents'
import { parseTableState, timeRangeSince, DEFAULT_PAGE_SIZE } from '@/lib/tableParams'
import AgentEventsTableServer from './AgentEventsTableServer'

const NO_MATCH = '00000000-0000-0000-0000-000000000000'
const CMD_LABEL: Record<string, string> = { restart: 'Restart', update: 'Update', uninstall: 'Uninstall' }
const EVENT_PAGE_SIZE = DEFAULT_PAGE_SIZE
const EV_SORT: Record<string, string> = { level: 'level', event: 'event', message: 'message', time: 'created_at' }
const ATTENTION_TIERS = ['warning', 'stale', 'lost', 'never'] as const  // offline long enough to matter

export default async function AgentMonitorPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const supabase = await createClient()
  const profile = await getCallerProfile(supabase)
  if (!profile) redirect('/login')
  if (!isMspStaff(profile)) redirect('/')

  const orgIds = await getAccessibleOrgIds(supabase, profile)
  const admin = createAdminClient()
  const scopeIds = orgIds === null ? null : (orgIds.length ? orgIds : [NO_MATCH])
  const inactiveBefore = new Date(Date.now() - INACTIVE_MS).toISOString()  // offline 14+ days = attention
  const evState = parseTableState(await searchParams)

  // Exact fleet aggregates (grouped-count RPCs) + bounded preview queries.
  let offlineQ = admin.from('devices').select('device_id, hostname, last_seen')
    .or(`last_seen.is.null,last_seen.lt.${inactiveBefore}`).order('last_seen', { ascending: true, nullsFirst: true }).limit(6)
  let pendingQ = admin.from('devices').select('device_id, hostname, pending_command').not('pending_command', 'is', null).limit(50)
  if (scopeIds) { offlineQ = offlineQ.in('org_id', scopeIds); pendingQ = pendingQ.in('org_id', scopeIds) }

  const [{ data: healthRows }, { data: versionRows }, { data: offlineRows }, { data: pendingRows }] = await Promise.all([
    admin.rpc('device_health_counts', { org_ids: orgIds }),
    admin.rpc('device_version_counts', { org_ids: orgIds }),
    offlineQ,
    pendingQ,
  ])

  // agent_events carries org_id (populated by a DB trigger from the device row,
  // migration 0011), so org-scoping is a direct indexed filter. The event stream
  // below is server-paginated (URL params); the "needs attention" errors are a
  // separate bounded query so they don't depend on the current page.
  const ef = evState.filters
  // The device filter matches by hostname; agent_events only has device_id, so
  // resolve matching device ids first (bounded).
  let deviceFilterIds: string[] | null = null
  if (ef.device) {
    let dq = admin.from('devices').select('device_id').ilike('hostname', `%${ef.device}%`).limit(1000)
    if (scopeIds) dq = dq.in('org_id', scopeIds)
    const { data: dm } = await dq
    deviceFilterIds = (dm ?? []).map(d => d.device_id)
  }
  const evFrom = (evState.page - 1) * EVENT_PAGE_SIZE
  let evQ = admin.from('agent_events').select('id, device_id, level, event, message, created_at', { count: 'exact' })
  if (scopeIds) evQ = evQ.in('org_id', scopeIds)
  if (ef.level) evQ = evQ.eq('level', ef.level)
  if (ef.event) evQ = evQ.eq('event', ef.event)
  if (ef.message) evQ = evQ.ilike('message', `%${ef.message}%`)
  if (ef.time) { const since = timeRangeSince(ef.time); if (since) evQ = evQ.gte('created_at', since) }
  if (deviceFilterIds !== null) evQ = evQ.in('device_id', deviceFilterIds.length ? deviceFilterIds : [NO_MATCH])
  if (evState.sort && EV_SORT[evState.sort]) evQ = evQ.order(EV_SORT[evState.sort], { ascending: evState.dir === 'asc' })
  else evQ = evQ.order('created_at', { ascending: false })
  const { data: events, count: evCount } = await evQ.range(evFrom, evFrom + EVENT_PAGE_SIZE - 1)
  const evList = events ?? []

  // Recent error events (24h) for the attention section — independent of the
  // paginated stream above so it stays accurate regardless of page/filters.
  const dayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  let errQ = admin.from('agent_events').select('device_id, event, message, created_at')
    .eq('level', 'error').gte('created_at', dayAgoIso).order('created_at', { ascending: false }).limit(50)
  if (scopeIds) errQ = errQ.in('org_id', scopeIds)
  const { data: recentErrorRows } = await errQ
  const recentErrors = recentErrorRows ?? []

  // ── Aggregates ────────────────────────────────────────────────────────────
  const tierCounts: Record<string, number> = {}
  for (const r of (healthRows ?? []) as { tier: string; count: number }[]) tierCounts[r.tier] = Number(r.count)
  const total = Object.values(tierCounts).reduce((a, b) => a + b, 0)
  const healthy = tierCounts.healthy ?? 0
  const offlineCount = (ATTENTION_TIERS as readonly string[]).reduce((a, t) => a + (tierCounts[t] ?? 0), 0)

  const versionRowsT = (versionRows ?? []) as { agent_version: string; count: number }[]
  const versions = versionRowsT.map(v => [v.agent_version, Number(v.count)] as [string, number]).sort((a, b) => b[0].localeCompare(a[0]))
  const outdated = versionRowsT
    .filter(v => isVersionBehind(v.agent_version === 'unknown' ? null : v.agent_version))
    .reduce((s, v) => s + Number(v.count), 0)

  const pending = ((pendingRows ?? []) as { device_id: string; hostname: string; pending_command: string }[])
    .map(d => ({ hostname: cleanHostname(d.hostname) || d.device_id, command: CMD_LABEL[d.pending_command] ?? d.pending_command }))

  // Hostname map — only devices referenced by the current event page + the
  // recent-error attention rows.
  const evDeviceIds = [...new Set([...evList, ...recentErrors].map(e => e.device_id).filter(Boolean))]
  const { data: evDevices } = evDeviceIds.length
    ? await admin.from('devices').select('device_id, hostname').in('device_id', evDeviceIds)
    : { data: [] }
  const hostnameById = Object.fromEntries((evDevices ?? []).map(d => [d.device_id, cleanHostname(d.hostname) || d.device_id]))

  // Needs attention: recent error events (24h) + a preview of long-offline devices.
  const attention: { hostname: string; issue: string; time: string | null; level: 'error' | 'warn' }[] = [
    ...recentErrors.map(e => ({ hostname: hostnameById[e.device_id] ?? e.device_id, issue: `${agentEventLabel(e.event)}${e.message ? ' — ' + e.message : ''}`, time: e.created_at, level: 'error' as const })),
    ...((offlineRows ?? []) as { device_id: string; hostname: string; last_seen: string | null }[])
      .map(d => ({ hostname: cleanHostname(d.hostname) || d.device_id, issue: `No heartbeat — ${TIER_LABEL[getHealthTier(d.last_seen)]}`, time: d.last_seen, level: 'warn' as const })),
  ].sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''))
  const attentionTotal = offlineCount + recentErrors.length

  const stats: { label: string; value: number; accent?: 'green' | 'yellow' | 'red' }[] = [
    { label: 'Agents', value: total },
    { label: 'Healthy', value: healthy, accent: 'green' },
    { label: 'Needs attention', value: attentionTotal, accent: attentionTotal ? 'red' : undefined },
    { label: 'Outdated', value: outdated, accent: outdated ? 'yellow' : undefined },
    { label: 'Pending commands', value: pending.length, accent: pending.length ? 'yellow' : undefined },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">Agents</h1>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {stats.map(s => (
          <div key={s.label} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <p className={`text-2xl font-bold ${
              s.accent === 'green' ? 'text-green-400' : s.accent === 'red' ? 'text-red-400' : s.accent === 'yellow' ? 'text-yellow-400' : 'text-white'
            }`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Needs attention — the hero */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Needs attention</h2>
          {attentionTotal > attention.slice(0, 6).length && <span className="text-xs text-gray-500">showing {Math.min(6, attention.length)} of {attentionTotal} — filter events below for the rest</span>}
        </div>
        {attention.length === 0 ? (
          <p className="text-gray-500 text-sm">All agents healthy and reporting in.</p>
        ) : (
          <div className="divide-y divide-gray-800 -mx-4 -mb-4">
            {attention.slice(0, 6).map((a, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${a.level === 'error' ? 'bg-red-500' : 'bg-orange-400'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate">{a.hostname}</p>
                  <p className="text-xs text-gray-400 truncate">{a.issue}</p>
                </div>
                <span className="text-xs text-gray-600 whitespace-nowrap">{a.time ? new Date(a.time).toLocaleDateString() : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending commands + version distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Pending commands</h2>
            {pending.length > 6 && <span className="text-xs text-gray-500">showing 6 of {pending.length}</span>}
          </div>
          {pending.length === 0 ? (
            <p className="text-gray-500 text-sm">No commands queued.</p>
          ) : (
            <div className="divide-y divide-gray-800 -mx-4 -mb-4">
              {pending.slice(0, 6).map((p, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-white truncate">{p.hostname}</span>
                  <span className="text-xs text-blue-300 bg-blue-950 px-2 py-0.5 rounded-full shrink-0 ml-2">{p.command} queued</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Agent versions</h2>
          {versions.length === 0 ? (
            <p className="text-gray-500 text-sm">No agents enrolled yet.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {versions.map(([v, count]) => {
                const behind = v === 'unknown' || isVersionBehind(v)
                return (
                  <span key={v} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border ${behind ? 'border-yellow-900 bg-yellow-950/40 text-yellow-300' : 'border-gray-700 bg-gray-800 text-gray-200'}`}>
                    <span className="font-mono">{v}</span>
                    <span className="text-gray-500">×{count}</span>
                  </span>
                )
              })}
              <span className="text-xs text-gray-500 self-center ml-1">latest v{AGENT_VERSION}</span>
            </div>
          )}
        </div>
      </div>

      {/* Event stream — the drill-down (server-paginated; filter to find a specific agent) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Agent events</h2>
          <span className="text-xs text-gray-500">{evCount ?? 0} total — filter to find a specific agent</span>
        </div>
        <AgentEventsTableServer
          events={evList}
          total={evCount ?? 0}
          state={evState}
          pageSize={EVENT_PAGE_SIZE}
          hostnameById={hostnameById}
          userId={profile.id}
        />
      </div>
    </div>
  )
}
