import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'
import { resolveRuleMatches, type PolicyRule, type MatchType } from '@/lib/policyRules'

const MATCH_TYPES = ['publisher', 'path', 'name']

// Dry-run: how many apps would a prospective rule match right now? Used to show
// the impact before the admin commits.
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const profile = await getCallerProfile(supabase)
  if (!profile || !isMspStaff(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgIds = await getAccessibleOrgIds(supabase, profile)

  const { org_id, match_type, match_value } = await req.json()
  if (!org_id || !MATCH_TYPES.includes(match_type) || !(match_value || '').trim()) {
    return NextResponse.json({ error: 'org_id, match_type and match_value are required' }, { status: 400 })
  }
  if (orgIds !== null && !orgIds.includes(org_id)) {
    return NextResponse.json({ error: 'No access to that organization' }, { status: 403 })
  }

  const rule: PolicyRule = {
    scope_type: 'org', scope_id: org_id,
    match_type: match_type as MatchType, match_value: match_value.trim(), action: 'block',
  }
  const matches = await resolveRuleMatches(createAdminClient(), rule)
  return NextResponse.json({
    matched: matches.length,
    names: matches.slice(0, 8).map(m => m.name),
    enforceable: matches.filter(m => m.process_name).length,
  })
}
