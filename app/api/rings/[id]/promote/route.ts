import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'

// Promote a ring's policies to the next ring (next position in the same org).
// Copies this ring's app_policies onto the next ring — the staged-rollout step:
// validate on Test, then push the same policy set to Pilot, then Production.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const profile = await getCallerProfile(supabase)
  if (!profile || !isMspStaff(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data: ring } = await admin.from('rings').select('id, org_id, position').eq('id', id).maybeSingle()
  if (!ring) return NextResponse.json({ error: 'Ring not found' }, { status: 404 })

  const orgIds = await getAccessibleOrgIds(supabase, profile)
  if (orgIds !== null && !orgIds.includes(ring.org_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: next } = await admin.from('rings')
    .select('id, name').eq('org_id', ring.org_id).gt('position', ring.position)
    .order('position').limit(1).maybeSingle()
  if (!next) return NextResponse.json({ error: 'This is the last ring — nothing to promote to' }, { status: 400 })

  const { data: policies } = await admin.from('app_policies')
    .select('app_id, status').eq('scope_type', 'ring').eq('scope_id', id)
  if (!policies || policies.length === 0) {
    return NextResponse.json({ error: 'This ring has no policy overrides to promote' }, { status: 400 })
  }

  const { error } = await admin.from('app_policies').upsert(
    policies.map(p => ({ app_id: p.app_id, scope_type: 'ring', scope_id: next.id, status: p.status })),
    { onConflict: 'app_id,scope_type,scope_id' },
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true, promotedTo: next.name, count: policies.length })
}
