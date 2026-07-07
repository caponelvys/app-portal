import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'
import { materializeRule, resolveRuleMatches, type PolicyRule, type MatchType, type RuleAction } from '@/lib/policyRules'

const MATCH_TYPES = ['publisher', 'path', 'name']
const ACTIONS = ['allow', 'block']

async function caller() {
  const supabase = await createServerClient()
  const profile = await getCallerProfile(supabase)
  if (!profile || !isMspStaff(profile)) return null
  return { supabase, profile, orgIds: await getAccessibleOrgIds(supabase, profile) }
}

// List rules within the caller's accessible orgs, with a live match count.
export async function GET() {
  const c = await caller()
  if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const admin = createAdminClient()

  let q = admin.from('policy_rules').select('*').order('created_at', { ascending: false })
  if (c.orgIds !== null) q = q.in('org_id', c.orgIds.length ? c.orgIds : ['00000000-0000-0000-0000-000000000000'])
  const { data: rules } = await q

  const withCounts = await Promise.all((rules ?? []).map(async r => ({
    ...r,
    matched: (await resolveRuleMatches(admin, r as PolicyRule)).length,
  })))
  return NextResponse.json({ rules: withCounts })
}

// Create an org-scoped rule and materialize it immediately.
export async function POST(req: NextRequest) {
  const c = await caller()
  if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { org_id, match_type, match_value, action } = await req.json()
  if (!org_id || !MATCH_TYPES.includes(match_type) || !ACTIONS.includes(action) || !(match_value || '').trim()) {
    return NextResponse.json({ error: 'org_id, match_type, match_value and action are required' }, { status: 400 })
  }
  // Org-scoping: msp_tech can only target their orgs.
  if (c.orgIds !== null && !c.orgIds.includes(org_id)) {
    return NextResponse.json({ error: 'No access to that organization' }, { status: 403 })
  }

  const admin = createAdminClient()
  const rule: PolicyRule = {
    scope_type: 'org', scope_id: org_id,
    match_type: match_type as MatchType, match_value: match_value.trim(), action: action as RuleAction,
  }

  const { data: saved, error } = await admin.from('policy_rules')
    .insert({ ...rule, org_id, created_by: c.profile.id }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const result = await materializeRule(admin, { ...rule, id: saved.id })
  return NextResponse.json({ success: true, id: saved.id, ...result })
}
