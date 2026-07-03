import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { redirect } from 'next/navigation'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'
import { parseTableState, DEFAULT_PAGE_SIZE } from '@/lib/tableParams'
import ReportsView from './ReportsView'
import type { AuditEvent } from './AuditTableServer'

const NO_MATCH = '00000000-0000-0000-0000-000000000000'
const PAGE_SIZE = DEFAULT_PAGE_SIZE

// Audit column id → audit_timeline view column.
const SORT_COLUMN: Record<string, string> = {
  when: 'time', event: 'kind', app: 'app', who: 'actor', detail: 'detail',
}

// Date-range filter → ISO bounds (since inclusive, until inclusive).
function rangeBounds(range: string, from?: string, to?: string): { since: string | null; until: string | null } {
  const now = Date.now()
  const daysAgo = (d: number) => new Date(now - d * 86400e3).toISOString()
  switch (range) {
    case 'today': { const d = new Date(); d.setHours(0, 0, 0, 0); return { since: d.toISOString(), until: null } }
    case '7d':  return { since: daysAgo(7),  until: null }
    case '90d': return { since: daysAgo(90), until: null }
    case 'all': return { since: null, until: null }
    case 'custom': return {
      since: from ? new Date(from + 'T00:00:00').toISOString() : null,
      until: to ? new Date(to + 'T23:59:59.999').toISOString() : null,
    }
    case '30d':
    default: return { since: daysAgo(30), until: null }
  }
}

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const supabase = await createClient()
  const profile = await getCallerProfile(supabase)
  if (!profile) redirect('/login')
  if (!isMspStaff(profile)) redirect('/')

  const orgIds = await getAccessibleOrgIds(supabase, profile)
  const scoped = orgIds !== null
  const scopeIds = scoped ? (orgIds!.length ? orgIds! : [NO_MATCH]) : null

  const state = parseTableState(await searchParams)
  const f = state.filters
  const { since, until } = rangeBounds(f.range ?? '30d', f.from, f.to)
  const rowFrom = (state.page - 1) * PAGE_SIZE
  const asc = state.dir === 'asc'
  const admin = createAdminClient()

  // ── Page of unified timeline events (DB filter/sort/paginate + exact count) ──
  let q = admin.from('audit_timeline').select('time, kind, app, actor, detail', { count: 'exact' })
  if (scopeIds) q = q.in('org_id', scopeIds)
  if (since) q = q.gte('time', since)
  if (until) q = q.lte('time', until)
  if (f.event) q = q.eq('kind', f.event)
  if (f.app) q = q.ilike('app', `%${f.app}%`)
  if (f.who) q = q.ilike('actor', `%${f.who}%`)
  q = q.order(SORT_COLUMN[state.sort ?? ''] ?? 'time', { ascending: state.sort ? asc : false })

  const [{ data: rows, count }, { data: kindRows }, orgsRes] = await Promise.all([
    q.range(rowFrom, rowFrom + PAGE_SIZE - 1),
    admin.rpc('audit_kind_counts', { org_ids: orgIds, p_since: since, p_until: until, p_app: f.app ?? null, p_actor: f.who ?? null }),
    (scopeIds
      ? admin.from('orgs').select('id, name').in('id', scopeIds).order('name')
      : admin.from('orgs').select('id, name').order('name')),
  ])

  const counts = Object.fromEntries(((kindRows ?? []) as { kind: string; count: number }[]).map(r => [r.kind, Number(r.count)]))

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <ReportsView
        events={(rows ?? []) as AuditEvent[]}
        total={count ?? 0}
        counts={counts}
        state={state}
        pageSize={PAGE_SIZE}
        orgs={orgsRes.data ?? []}
        userId={profile.id}
      />
    </div>
  )
}
