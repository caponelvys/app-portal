import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'
import { scopeOrgId } from '@/lib/policyHistory'

// Which table/key each scope maps to. Device is keyed on device_id (text).
const TARGET: Record<string, { table: string; key: string }> = {
  org:      { table: 'orgs',      key: 'id' },
  location: { table: 'locations', key: 'id' },
  device:   { table: 'devices',   key: 'device_id' },
}

// Set a scope's enforcement mode. mode 'inherit' clears the override (NULL), so
// the scope falls back to its parent (device → location → org → enforce).
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const profile = await getCallerProfile(supabase)
  if (!profile || !isMspStaff(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { scope, scopeId, mode } = await req.json()
  const target = TARGET[scope]
  if (!target || !scopeId || !['enforce', 'learn', 'inherit'].includes(mode)) {
    return NextResponse.json({ error: 'valid scope, scopeId and mode (enforce|learn|inherit) are required' }, { status: 400 })
  }

  const admin = createAdminClient()
  // Resolve the scope's owning org and enforce the caller's access to it.
  const org = await scopeOrgId(admin, scope, scopeId)
  if (!org) return NextResponse.json({ error: 'Scope target not found' }, { status: 404 })
  const orgIds = await getAccessibleOrgIds(supabase, profile)
  if (orgIds !== null && !orgIds.includes(org)) {
    return NextResponse.json({ error: 'No access to that scope' }, { status: 403 })
  }

  const value = mode === 'inherit' ? null : mode
  const { error: updErr } = await admin
    .from(target.table)
    .update({ enforcement_mode: value })
    .eq(target.key, scopeId)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })

  return NextResponse.json({ success: true, mode: value })
}
