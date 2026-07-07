import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'
import { materializeRule, type PolicyRule } from '@/lib/policyRules'

async function accessibleRule(id: string) {
  const supabase = await createServerClient()
  const profile = await getCallerProfile(supabase)
  if (!profile || !isMspStaff(profile)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  const admin = createAdminClient()
  const { data: rule } = await admin.from('policy_rules').select('*').eq('id', id).maybeSingle()
  if (!rule) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  const orgIds = await getAccessibleOrgIds(supabase, profile)
  if (orgIds !== null && (!rule.org_id || !orgIds.includes(rule.org_id))) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { admin, rule: rule as PolicyRule }
}

// Re-apply a rule against current inventory (new matching software gets
// materialized). Idempotent for already-materialized apps.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { admin, rule, error } = await accessibleRule(id)
  if (error) return error
  const result = await materializeRule(admin, rule)
  return NextResponse.json({ success: true, ...result })
}

// Delete the rule. Materialized catalog apps / policies are left in place — the
// rule is the generator, not an owner; unwind those from the app/policy pages.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { admin, error } = await accessibleRule(id)
  if (error) return error
  const { error: delErr } = await admin.from('policy_rules').delete().eq('id', id)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
