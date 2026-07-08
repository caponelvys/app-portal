import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'
import { scopeOrgId, currentPolicyStatus, recordPolicyChange } from '@/lib/policyHistory'

async function requireStaff() {
  const supabase = await createServerClient()
  const profile = await getCallerProfile(supabase)
  if (!profile || !isMspStaff(profile)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  const admin = createAdminClient()
  const orgIds = await getAccessibleOrgIds(supabase, profile)
  return { admin, userId: profile.id, orgIds }
}

// Resolve the scope's owning org and confirm the caller can manage it.
async function assertScopeAccess(admin: ReturnType<typeof createAdminClient>, orgIds: string[] | null, scope: string, scopeId: string) {
  const org = await scopeOrgId(admin, scope, scopeId)
  if (!org) return { ok: false as const, res: NextResponse.json({ error: 'Scope target not found' }, { status: 404 }) }
  if (orgIds !== null && !orgIds.includes(org)) return { ok: false as const, res: NextResponse.json({ error: 'No access to that scope' }, { status: 403 }) }
  return { ok: true as const, org }
}

const SCOPES = ['org', 'location', 'device', 'ring']

// Set (or update) a policy override at a scope.
export async function POST(req: NextRequest) {
  const { admin, userId, orgIds, error } = await requireStaff()
  if (error) return error

  const { app_id, scope_type, scope_id, status } = await req.json()
  if (!app_id || !scope_id || !SCOPES.includes(scope_type) || (status !== 'allowed' && status !== 'blocked')) {
    return NextResponse.json({ error: 'app_id, scope_id, valid scope_type and status are required' }, { status: 400 })
  }

  const access = await assertScopeAccess(admin!, orgIds!, scope_type, scope_id)
  if (!access.ok) return access.res

  const before = await currentPolicyStatus(admin, app_id, scope_type, scope_id)
  const { error: upsertError } = await admin
    .from('app_policies')
    .upsert({ app_id, scope_type, scope_id, status }, { onConflict: 'app_id,scope_type,scope_id' })
  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 400 })

  if (before !== status) {
    await recordPolicyChange(admin, {
      scope_type, scope_id, app_id, old_status: before, new_status: status,
      org_id: access.org, changed_by: userId,
    })
  }
  return NextResponse.json({ success: true })
}

// Clear an override at a scope (revert to inherited).
export async function DELETE(req: NextRequest) {
  const { admin, userId, orgIds, error } = await requireStaff()
  if (error) return error

  const { app_id, scope_type, scope_id } = await req.json()
  if (!app_id || !scope_id || !SCOPES.includes(scope_type)) {
    return NextResponse.json({ error: 'app_id, scope_id and a valid scope_type are required' }, { status: 400 })
  }

  const access = await assertScopeAccess(admin!, orgIds!, scope_type, scope_id)
  if (!access.ok) return access.res

  const before = await currentPolicyStatus(admin, app_id, scope_type, scope_id)
  const { error: delError } = await admin
    .from('app_policies')
    .delete()
    .eq('app_id', app_id)
    .eq('scope_type', scope_type)
    .eq('scope_id', scope_id)
  if (delError) return NextResponse.json({ error: delError.message }, { status: 400 })

  if (before !== null) {
    await recordPolicyChange(admin, {
      scope_type, scope_id, app_id, old_status: before, new_status: null,
      org_id: access.org, changed_by: userId,
    })
  }
  return NextResponse.json({ success: true })
}
