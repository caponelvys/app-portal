import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'
import { resolveRuleMatches, resolveScopeOrgId, type PolicyRule, type MatchType, type ScopeType } from '@/lib/policyRules'

const MATCH_TYPES = ['publisher', 'path', 'name', 'hash']
const SCOPES = ['org', 'location', 'device']

// Dry-run: how many apps would a prospective rule match right now? Used to show
// the impact before the admin commits.
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const profile = await getCallerProfile(supabase)
  if (!profile || !isMspStaff(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgIds = await getAccessibleOrgIds(supabase, profile)

  const { scope_type, scope_id, match_type, match_value } = await req.json()
  if (!SCOPES.includes(scope_type) || !scope_id || !MATCH_TYPES.includes(match_type) || !(match_value || '').trim()) {
    return NextResponse.json({ error: 'scope_type, scope_id, match_type and match_value are required' }, { status: 400 })
  }
  const admin = createAdminClient()
  const orgId = await resolveScopeOrgId(admin, scope_type as ScopeType, scope_id)
  if (!orgId) return NextResponse.json({ error: 'Scope target not found' }, { status: 404 })
  if (orgIds !== null && !orgIds.includes(orgId)) {
    return NextResponse.json({ error: 'No access to that scope' }, { status: 403 })
  }

  const rule: PolicyRule = {
    scope_type: scope_type as ScopeType, scope_id,
    match_type: match_type as MatchType, match_value: match_value.trim(), action: 'block',
  }
  const matches = await resolveRuleMatches(admin, rule)
  return NextResponse.json({
    matched: matches.length,
    names: matches.slice(0, 8).map(m => m.name),
    enforceable: matches.filter(m => m.process_name).length,
  })
}
