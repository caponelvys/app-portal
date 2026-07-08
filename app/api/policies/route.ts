import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { scopeOrgId, currentPolicyStatus, recordPolicyChange } from '@/lib/policyHistory'

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { admin: createAdminClient(), userId: user.id }
}

const SCOPES = ['org', 'location', 'device', 'ring']

// Set (or update) a policy override at a scope.
export async function POST(req: NextRequest) {
  const { admin, userId, error } = await requireAdmin()
  if (error) return error

  const { app_id, scope_type, scope_id, status } = await req.json()
  if (!app_id || !scope_id || !SCOPES.includes(scope_type) || (status !== 'allowed' && status !== 'blocked')) {
    return NextResponse.json({ error: 'app_id, scope_id, valid scope_type and status are required' }, { status: 400 })
  }

  const before = await currentPolicyStatus(admin, app_id, scope_type, scope_id)
  const { error: upsertError } = await admin
    .from('app_policies')
    .upsert({ app_id, scope_type, scope_id, status }, { onConflict: 'app_id,scope_type,scope_id' })
  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 400 })

  if (before !== status) {
    await recordPolicyChange(admin, {
      scope_type, scope_id, app_id, old_status: before, new_status: status,
      org_id: await scopeOrgId(admin, scope_type, scope_id), changed_by: userId,
    })
  }
  return NextResponse.json({ success: true })
}

// Clear an override at a scope (revert to inherited).
export async function DELETE(req: NextRequest) {
  const { admin, userId, error } = await requireAdmin()
  if (error) return error

  const { app_id, scope_type, scope_id } = await req.json()
  if (!app_id || !scope_id || !SCOPES.includes(scope_type)) {
    return NextResponse.json({ error: 'app_id, scope_id and a valid scope_type are required' }, { status: 400 })
  }

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
      org_id: await scopeOrgId(admin, scope_type, scope_id), changed_by: userId,
    })
  }
  return NextResponse.json({ success: true })
}
