import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'

async function caller() {
  const supabase = await createServerClient()
  const profile = await getCallerProfile(supabase)
  if (!profile || !isMspStaff(profile)) return null
  return { profile, orgIds: await getAccessibleOrgIds(supabase, profile) }
}

const DEFAULT_RINGS = [
  { name: 'Test', position: 0 },
  { name: 'Pilot', position: 1 },
  { name: 'Production', position: 2 },
]

// Create a ring, or seed the standard test/pilot/prod set when `defaults` is set.
export async function POST(req: NextRequest) {
  const c = await caller()
  if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { org_id, name, position, defaults } = await req.json()
  if (!org_id) return NextResponse.json({ error: 'org_id is required' }, { status: 400 })
  if (c.orgIds !== null && !c.orgIds.includes(org_id)) {
    return NextResponse.json({ error: 'No access to that organization' }, { status: 403 })
  }
  const admin = createAdminClient()

  if (defaults) {
    const { error } = await admin.from('rings').insert(DEFAULT_RINGS.map(r => ({ ...r, org_id })))
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true, created: DEFAULT_RINGS.length })
  }

  if (!(name || '').trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  const { data, error } = await admin.from('rings')
    .insert({ org_id, name: name.trim(), position: Number.isFinite(position) ? position : 0 })
    .select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true, id: data.id })
}
