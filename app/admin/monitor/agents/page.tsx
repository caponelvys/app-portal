import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { redirect } from 'next/navigation'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'
import { cleanHostname } from '@/lib/hostname'
import { getHealthTier, TIER_LABEL } from '@/lib/deviceStatus'
import { AGENT_VERSION, isVersionBehind } from '@/lib/agentVersion'
import { agentEventLabel } from '@/lib/agentEvents'
import AgentEventsTable from './AgentEventsTable'

const NO_MATCH = '00000000-0000-0000-0000-000000000000'
const CMD_LABEL: Record<string, string> = { restart: 'Restart', update: 'Update', uninstall: 'Uninstall' }
const EVENT_LIMIT = 200          // recent events pulled for the stream + previews
const ATTENTION_TIERS = ['warning', 'stale', 'lost', 'never'] as const  // offline long enough to matter

export default async function AgentMonitorPage() {
  const supabase = await createClient()
  const profile = await getCallerProfile(supabase)
  if (!profile) redirect('/login')
  if (!isMspStaff(profile)) redirect('/')

  const orgIds = await getAccessibleOrgIds(supabase, profile)
  const admin = createAdminClient()

  // Devices (org-scoped, small columns). At extreme scale this becomes SQL
  // aggregation / pagination — see scale-first memory.
  let devsQ = admin.from('devices').select('device_id, hostname, last_seen, agent_version, org_id, pending_command')
  if (orgIds !== null) devsQ = devsQ.in('org_id', orgIds.length ? orgIds : [NO_MATCH])
  const { data: devices } = await devsQ
  const devList = devices ?? []
  const deviceIds = devList.map(d => d.device_id)
  const hostnameById = Object.fromEntries(devList.map(d => [d.device_id, cleanHostname(d.hostname) || d.device_id]))

  // Only the most recent events are pulled — the stream is a drill-down, not a firehose.
  const { data: events } = deviceIds.length
    ? await admin.from('agent_events').select('id, device_id, level, event, message, created_at')
        .in('device_id', deviceIds).order('created_at', { ascending: false }).limit(EVENT_LIMIT)
    : { data: [] }
  const evList = events ?? []

  // ── Aggregates ────────────────────────────────────────────────────────────
  const total = devList.length
  const healthy = devList.filter(d => getHealthTier(d.last_seen) === 'healthy').length
  const outdated = devList.filter(d => isVersionBehind(d.agent_version)).length
  const pending = devList
    .filter(d => d.pending_command)
    .map(d => ({ hostname: cleanHostname(d.hostname) || d.device_id, command: CMD_LABEL[d.pending_command] ?? d.pending_command }))

  const versionCount = new Map<string, number>()
  for (const d of devList) {
    const v = d.agent_version ?? 'unknown'
    versionCount.set(v, (versionCount.get(v) ?? 0) + 1)
  }
  const versions = [...versionCount.entries()].sort((a, b) => b[0].localeCompare(a[0]))

  // Needs attention: recent error events (24h) + devices offline long enough (warning+).
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000
  const attention: { hostname: string; issue: string; time: string | null; level: 'error' | 'warn' }[] = []
  for (const e of evList) {
    if (e.level === 'error' && new Date(e.created_at).getTime() >= dayAgo) {
      attention.push({ hostname: hostnameById[e.device_id] ?? e.device_id, issue: `${agentEventLabel(e.event)}${e.message ? ' — ' + e.message : ''}`, time: e.created_at, level: 'error' })
    }
  }
  for (const d of devList) {
    const tier = getHealthTier(d.last_seen)
    if ((ATTENTION_TIERS as readonly string[]).includes(tier)) {
      attention.push({ hostname: cleanHostname(d.hostname) || d.device_id, issue: `No heartbeat — ${TIER_LABEL[tier]}`, time: d.last_seen, level: 'warn' })
    }
  }
  attention.sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''))

  const stats: { label: string; value: number; accent?: 'green' | 'yellow' | 'red' }[] = [
    { label: 'Agents', value: total },
    { label: 'Healthy', value: healthy, accent: 'green' },
    { label: 'Needs attention', value: attention.length, accent: attention.length ? 'red' : undefined },
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
          {attention.length > 6 && <span className="text-xs text-gray-500">showing 6 of {attention.length} — filter events below for the rest</span>}
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

      {/* Event stream — the drill-down (recent only; filter to find a specific agent) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Agent events</h2>
          <span className="text-xs text-gray-500">most recent {evList.length}{evList.length >= EVENT_LIMIT ? '+' : ''} — filter to find a specific agent</span>
        </div>
        <AgentEventsTable events={evList} hostnameById={hostnameById} userId={profile.id} />
      </div>
    </div>
  )
}
