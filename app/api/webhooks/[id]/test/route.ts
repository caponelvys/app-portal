import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'
import { sendTest } from '@/lib/webhooks'

// Deliver a signed sample event to the endpoint now, so the receiver can be
// verified before real events flow.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const profile = await getCallerProfile(supabase)
  if (!profile || !isMspStaff(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data: ep } = await admin.from('webhook_endpoints').select('id, org_id, url, secret').eq('id', id).maybeSingle()
  if (!ep) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const orgIds = await getAccessibleOrgIds(supabase, profile)
  if (orgIds !== null && (!ep.org_id || !orgIds.includes(ep.org_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const res = await sendTest(ep)
  await admin.from('webhook_endpoints')
    .update({ last_status: res.ok ? `test ok ${res.status}` : (res.status ? `test http ${res.status}` : 'test unreachable'), last_delivered_at: new Date().toISOString() })
    .eq('id', id)
  return NextResponse.json({ success: res.ok, status: res.status })
}
