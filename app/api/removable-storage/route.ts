import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'
import { scopeOrgId } from '@/lib/policyHistory'

const TARGET: Record<string, { table: string; key: string }> = {
  org:      { table: 'orgs',      key: 'id' },
  location: { table: 'locations', key: 'id' },
  ring:     { table: 'rings',     key: 'id' },
  device:   { table: 'devices',   key: 'device_id' },
}

// Set a scope's removable-storage policy. mode 'inherit' clears the override
// (NULL) so the scope falls back to its parent (device > ring > location > org).
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const profile = await getCallerProfile(supabase)
  if (!profile || !isMspStaff(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { scope, scopeId, mode } = await req.json()
  const target = TARGET[scope]
  if (!target || !scopeId || !['allow', 'block', 'inherit'].includes(mode)) {
    return NextResponse.json({ error: 'valid scope, scopeId and mode (allow|block|inherit) are required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const org = await scopeOrgId(admin, scope, scopeId)
  if (!org) return NextResponse.json({ error: 'Scope target not found' }, { status: 404 })
  const orgIds = await getAccessibleOrgIds(supabase, profile)
  if (orgIds !== null && !orgIds.includes(org)) {
    return NextResponse.json({ error: 'No access to that scope' }, { status: 403 })
  }

  const value = mode === 'inherit' ? null : mode
  const { error: updErr } = await admin
    .from(target.table)
    .update({ removable_storage: value })
    .eq(target.key, scopeId)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })

  return NextResponse.json({ success: true, mode: value })
}
