import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'
import { applyPolicy, currentPolicyStatus, recordPolicyChange, type Status } from '@/lib/policyHistory'

// Revert a logged change: restore (app, scope) to the change's old_status, and
// record the revert itself as a new change so history stays complete.
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const profile = await getCallerProfile(supabase)
  if (!profile || !isMspStaff(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { change_id } = await req.json()
  if (!change_id) return NextResponse.json({ error: 'change_id is required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: change } = await admin.from('policy_changes').select('*').eq('id', change_id).maybeSingle()
  if (!change) return NextResponse.json({ error: 'Change not found' }, { status: 404 })

  const orgIds = await getAccessibleOrgIds(supabase, profile)
  if (orgIds !== null && (!change.org_id || !orgIds.includes(change.org_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const target = (change.old_status as Status | null) ?? null
  const before = await currentPolicyStatus(admin, change.app_id, change.scope_type, change.scope_id)
  if (before === target) {
    return NextResponse.json({ error: 'Already at that value — nothing to revert' }, { status: 400 })
  }

  await applyPolicy(admin, change.app_id, change.scope_type, change.scope_id, target)
  await recordPolicyChange(admin, {
    scope_type: change.scope_type, scope_id: change.scope_id, app_id: change.app_id,
    old_status: before, new_status: target, org_id: change.org_id, changed_by: profile.id,
  })
  return NextResponse.json({ success: true })
}
