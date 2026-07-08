import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'

async function caller() {
  const supabase = await createServerClient()
  const profile = await getCallerProfile(supabase)
  if (!profile || !isMspStaff(profile)) return null
  return { supabase, profile, orgIds: await getAccessibleOrgIds(supabase, profile) }
}

// List endpoints within the caller's accessible orgs.
export async function GET() {
  const c = await caller()
  if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  let q = createAdminClient().from('webhook_endpoints')
    .select('id, org_id, url, enabled, last_status, last_delivered_at, created_at')
    .order('created_at', { ascending: false })
  if (c.orgIds !== null) q = q.in('org_id', c.orgIds.length ? c.orgIds : ['00000000-0000-0000-0000-000000000000'])
  const { data } = await q
  return NextResponse.json({ endpoints: data ?? [] })
}

// Create an endpoint. Returns the signing secret once (shown to the user to set
// up verification); only its presence is exposed afterward.
export async function POST(req: NextRequest) {
  const c = await caller()
  if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { url, org_id } = await req.json()
  if (!url || !/^https:\/\//i.test(url)) {
    return NextResponse.json({ error: 'An https:// URL is required' }, { status: 400 })
  }
  // msp_tech must scope to one of their orgs; msp_admin may leave it null (all).
  if (c.orgIds !== null) {
    if (!org_id || !c.orgIds.includes(org_id)) {
      return NextResponse.json({ error: 'Select an organization you manage' }, { status: 403 })
    }
  }

  const secret = 'whsec_' + crypto.randomBytes(24).toString('hex')
  const { data, error } = await createAdminClient().from('webhook_endpoints')
    .insert({ url, org_id: org_id ?? null, secret, created_by: c.profile.id })
    .select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true, id: data.id, secret })
}
