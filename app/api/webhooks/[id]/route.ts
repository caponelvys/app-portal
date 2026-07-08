import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'

async function accessibleEndpoint(id: string) {
  const supabase = await createServerClient()
  const profile = await getCallerProfile(supabase)
  if (!profile || !isMspStaff(profile)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  const admin = createAdminClient()
  const { data: ep } = await admin.from('webhook_endpoints').select('*').eq('id', id).maybeSingle()
  if (!ep) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  const orgIds = await getAccessibleOrgIds(supabase, profile)
  // msp_tech can only touch endpoints scoped to their orgs (not global ones).
  if (orgIds !== null && (!ep.org_id || !orgIds.includes(ep.org_id))) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { admin, ep }
}

// Enable/disable an endpoint.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { admin, error } = await accessibleEndpoint(id)
  if (error) return error
  const { enabled } = await req.json()
  const { error: e } = await admin.from('webhook_endpoints').update({ enabled: !!enabled }).eq('id', id)
  if (e) return NextResponse.json({ error: e.message }, { status: 400 })
  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { admin, error } = await accessibleEndpoint(id)
  if (error) return error
  const { error: e } = await admin.from('webhook_endpoints').delete().eq('id', id)
  if (e) return NextResponse.json({ error: e.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
