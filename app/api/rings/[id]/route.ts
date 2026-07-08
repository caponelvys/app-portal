import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'

// Delete a ring. Member devices' ring_id clears via the FK (on delete set null).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const profile = await getCallerProfile(supabase)
  if (!profile || !isMspStaff(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data: ring } = await admin.from('rings').select('org_id').eq('id', id).maybeSingle()
  if (!ring) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const orgIds = await getAccessibleOrgIds(supabase, profile)
  if (orgIds !== null && !orgIds.includes(ring.org_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await admin.from('rings').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
