// Server-side resolver for policy_rules (M2 CP3b). A rule matches installed
// software by publisher / path / name within a scope's inventory, and
// "materializes" into the existing enforcement primitives: a catalog app per
// match (created if needed, keyed on process_name) plus an app_policy at the
// rule's scope. So publisher/path rules enforce through the proven kill-by-name
// path with no agent change, and re-resolve as inventory changes.

import type { SupabaseClient } from '@supabase/supabase-js'

export type MatchType = 'publisher' | 'path' | 'name' | 'hash'
export type RuleAction = 'allow' | 'block'
export type ScopeType = 'org' | 'location' | 'device'

export type PolicyRule = {
  id?: string
  scope_type: ScopeType
  scope_id: string
  match_type: MatchType
  match_value: string
  action: RuleAction
}

type SoftwareMatch = { name: string; process_name: string | null }

const MATCH_COLUMN: Record<MatchType, string> = {
  publisher: 'publisher',
  path: 'install_path',
  name: 'name',
  hash: 'sha256',
}

// The org that owns a scope target — for access checks and for stamping
// policy_rules.org_id (which scopes the rules list). Returns null if the target
// doesn't exist.
export async function resolveScopeOrgId(
  admin: SupabaseClient,
  scopeType: ScopeType,
  scopeId: string,
): Promise<string | null> {
  if (scopeType === 'org') return scopeId
  const table = scopeType === 'location' ? 'locations' : 'devices'
  const key = scopeType === 'location' ? 'id' : 'device_id'
  const { data } = await admin.from(table).select('org_id').eq(key, scopeId).maybeSingle()
  return data?.org_id ?? null
}

// Distinct software matching a rule within its scope's inventory. Dedupes by
// name, preferring a row that carries a process_name (the enforcement key).
export async function resolveRuleMatches(
  admin: SupabaseClient,
  rule: PolicyRule,
): Promise<SoftwareMatch[]> {
  let q = admin.from('device_software').select('name, process_name')

  if (rule.scope_type === 'org') {
    q = q.eq('org_id', rule.scope_id)
  } else if (rule.scope_type === 'device') {
    q = q.eq('device_id', rule.scope_id)
  } else {
    // location: resolve its devices, then filter inventory to them.
    const { data: devs } = await admin.from('devices').select('device_id').eq('location_id', rule.scope_id)
    const ids = (devs ?? []).map(d => d.device_id)
    if (!ids.length) return []
    q = q.in('device_id', ids)
  }

  // Hash is an exact identity match; the rest are substring (contains).
  q = rule.match_type === 'hash'
    ? q.eq('sha256', rule.match_value.trim().toLowerCase())
    : q.ilike(MATCH_COLUMN[rule.match_type], `%${rule.match_value}%`)
  const { data } = await q

  const byName = new Map<string, SoftwareMatch>()
  for (const r of (data ?? []) as SoftwareMatch[]) {
    const cur = byName.get(r.name)
    if (!cur || (!cur.process_name && r.process_name)) byName.set(r.name, r)
  }
  return [...byName.values()]
}

// Materialize a rule: ensure a catalog app per match and set the policy at the
// rule's scope. Returns how many apps matched and how many are enforceable
// (block rules need a process_name to actually close the app).
export async function materializeRule(
  admin: SupabaseClient,
  rule: PolicyRule,
): Promise<{ matched: number; enforceable: number }> {
  const matches = await resolveRuleMatches(admin, rule)
  const status = rule.action === 'block' ? 'blocked' : 'allowed'
  let enforceable = 0

  for (const m of matches) {
    // Ensure a catalog app of this name exists (backfilling process_name).
    const { data: existing } = await admin
      .from('apps').select('id, process_name').ilike('name', m.name).limit(1).maybeSingle()

    let appId = existing?.id as string | undefined
    if (!appId) {
      const { data: created } = await admin
        .from('apps').insert({ name: m.name, process_name: m.process_name, status: 'allowed' })
        .select('id').single()
      appId = created?.id
    } else if (!existing?.process_name && m.process_name) {
      await admin.from('apps').update({ process_name: m.process_name }).eq('id', appId)
    }
    if (!appId) continue

    await admin.from('app_policies').upsert(
      { app_id: appId, scope_type: rule.scope_type, scope_id: rule.scope_id, status },
      { onConflict: 'app_id,scope_type,scope_id' },
    )
    if (rule.action === 'block' && m.process_name) enforceable++
  }

  return { matched: matches.length, enforceable }
}
