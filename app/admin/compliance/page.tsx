import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { redirect } from 'next/navigation'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'
import { FRAMEWORKS, frameworkById, KIND_LABEL, type AuditKind } from '@/lib/compliance'
import ComplianceControls from './ComplianceControls'

const RANGES = [
  { value: '7d', label: 'Last 7 days', days: 7 },
  { value: '30d', label: 'Last 30 days', days: 30 },
  { value: '90d', label: 'Last 90 days', days: 90 },
  { value: 'all', label: 'All time', days: 0 },
]

export default async function CompliancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const supabase = await createClient()
  const profile = await getCallerProfile(supabase)
  if (!profile) redirect('/login')
  if (!isMspStaff(profile)) redirect('/')

  const orgIds = await getAccessibleOrgIds(supabase, profile)
  const sp = await searchParams
  const first = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v

  const framework = frameworkById(first(sp.framework))
  const rangeVal = first(sp.range) ?? '30d'
  const range = RANGES.find(r => r.value === rangeVal) ?? RANGES[1]
  const since = range.days ? new Date(Date.now() - range.days * 86400e3).toISOString() : null

  const { data: kindRows } = await createAdminClient().rpc('audit_kind_counts', {
    org_ids: orgIds, p_since: since, p_until: null, p_app: null, p_actor: null,
  })
  const counts = new Map<string, number>((kindRows ?? []).map((r: { kind: string; count: number }) => [r.kind, Number(r.count)]))
  const countFor = (kinds: AuditKind[]) => kinds.reduce((s, k) => s + (counts.get(k) ?? 0), 0)

  const controls = framework.controls.map(c => ({
    id: c.id, name: c.name, description: c.description,
    evidence: countFor(c.kinds),
    kinds: c.kinds.map(k => ({ label: KIND_LABEL[k], count: counts.get(k) ?? 0 })).filter(x => x.count > 0),
  }))
  const totalEvents = [...counts.values()].reduce((a, b) => a + b, 0)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Compliance</h1>
      <p className="text-gray-500 text-sm mb-6">
        How Ravyn&apos;s immutable audit trail evidences common control frameworks. {totalEvents.toLocaleString()} audit events in this period.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {FRAMEWORKS.map(f => (
          <a key={f.id} href={`/admin/compliance?framework=${f.id}&range=${range.value}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              f.id === framework.id ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30' : 'bg-gray-800/60 text-gray-400 hover:text-gray-200 border border-transparent'
            }`}>
            {f.name}
          </a>
        ))}
        <span className="mx-1 h-4 w-px bg-gray-700" />
        {RANGES.map(r => (
          <a key={r.value} href={`/admin/compliance?framework=${framework.id}&range=${r.value}`}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              r.value === range.value ? 'bg-gray-700 text-gray-100' : 'text-gray-500 hover:text-gray-300'
            }`}>
            {r.label}
          </a>
        ))}
      </div>

      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">{framework.name}</h2>
        <p className="text-sm text-gray-500">{framework.blurb}</p>
      </div>

      <ComplianceControls controls={controls} />

      <p className="mt-6 text-xs text-gray-600">
        Control mappings are guidance for evidencing app-control activity, not a certification. Export the full record from Reports.
      </p>
    </div>
  )
}
