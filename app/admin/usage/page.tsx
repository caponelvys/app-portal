import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { redirect } from 'next/navigation'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'
import { liveUsage, monthStart, periodOf } from '@/lib/metering'
import CaptureSnapshot from './CaptureSnapshot'

const NO_MATCH = '00000000-0000-0000-0000-000000000000'

export default async function UsagePage() {
  const supabase = await createClient()
  const profile = await getCallerProfile(supabase)
  if (!profile) redirect('/login')
  if (!isMspStaff(profile)) redirect('/')

  const orgIds = await getAccessibleOrgIds(supabase, profile)
  const scopeIds = orgIds !== null ? (orgIds.length ? orgIds : [NO_MATCH]) : null

  const admin = createAdminClient()
  const now = new Date()
  const since = monthStart(now)
  const thisPeriod = periodOf(now)

  let orgQ = supabase.from('orgs').select('id, name').order('name').limit(1000)
  if (scopeIds) orgQ = orgQ.in('id', scopeIds)
  let snapQ = admin.from('usage_snapshots').select('org_id, period, device_count, active_count')
    .order('period', { ascending: false }).limit(500)
  if (scopeIds) snapQ = snapQ.in('org_id', scopeIds)

  const [usage, { data: orgs }, { data: snaps }] = await Promise.all([
    liveUsage(admin, scopeIds, since), orgQ, snapQ,
  ])

  const orgName = new Map((orgs ?? []).map(o => [o.id, o.name]))
  const usageById = new Map(usage.map(u => [u.org_id, u]))
  const rows = (orgs ?? []).map(o => ({
    name: o.name,
    total: usageById.get(o.id)?.total ?? 0,
    active: usageById.get(o.id)?.active ?? 0,
  })).sort((a, b) => b.active - a.active)

  const fleetTotal = rows.reduce((s, r) => s + r.total, 0)
  const fleetActive = rows.reduce((s, r) => s + r.active, 0)

  // Group snapshot history by period → summed active across accessible orgs.
  const byPeriod = new Map<string, { device: number; active: number }>()
  for (const s of snaps ?? []) {
    const p = byPeriod.get(s.period) ?? { device: 0, active: 0 }
    p.device += s.device_count; p.active += s.active_count
    byPeriod.set(s.period, p)
  }
  const history = [...byPeriod.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <h1 className="text-2xl font-bold text-white">Usage &amp; billing</h1>
        <CaptureSnapshot period={thisPeriod} />
      </div>
      <p className="text-gray-500 text-sm mb-6">
        Managed endpoints per organization. <span className="text-gray-400">Active</span> = checked in this month
        ({thisPeriod}) — the billable count. Enrolled = total devices on record.
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs text-gray-500">Active endpoints (billable)</p>
          <p className="mt-1 text-3xl font-bold text-white tabular-nums">{fleetActive.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs text-gray-500">Enrolled endpoints</p>
          <p className="mt-1 text-3xl font-bold text-gray-300 tabular-nums">{fleetTotal.toLocaleString()}</p>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-white mb-2">By organization</h2>
      <div className="rounded-xl border border-gray-800 bg-gray-900 divide-y divide-gray-800 mb-8">
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No organizations.</p>
        ) : rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-2.5">
            <span className="text-sm text-white">{r.name}</span>
            <span className="text-sm tabular-nums">
              <span className="text-white font-medium">{r.active.toLocaleString()}</span>
              <span className="text-gray-500"> active / {r.total.toLocaleString()} enrolled</span>
            </span>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-semibold text-white mb-2">Monthly history</h2>
      {history.length === 0 ? (
        <p className="text-sm text-gray-500">No snapshots captured yet. Capture this month, or the monthly job records prior months automatically.</p>
      ) : (
        <div className="rounded-xl border border-gray-800 bg-gray-900 divide-y divide-gray-800">
          {history.map(([period, v]) => (
            <div key={period} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-gray-300 font-mono">{period}</span>
              <span className="text-sm tabular-nums text-gray-400">
                <span className="text-white font-medium">{v.active.toLocaleString()}</span> active / {v.device.toLocaleString()} enrolled
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
