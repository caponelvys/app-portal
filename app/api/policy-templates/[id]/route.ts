import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'

// Delete a template (items cascade). Applied policies stay in place. Templates
// are a shared MSP-wide catalog, so only msp_admin (all-orgs) may remove one —
// a scoped tech can apply templates but not delete the shared catalog.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const profile = await getCallerProfile(supabase)
  if (!profile || !isMspStaff(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgIds = await getAccessibleOrgIds(supabase, profile)
  if (orgIds !== null) return NextResponse.json({ error: 'Only an MSP admin can delete shared templates' }, { status: 403 })

  const { error } = await createAdminClient().from('policy_templates').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
