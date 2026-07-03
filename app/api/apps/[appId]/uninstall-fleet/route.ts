import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, isMspStaff, getAccessibleOrgIds } from '@/lib/rbac'

const NO_MATCH = '00000000-0000-0000-0000-000000000000'
const CHUNK = 500

// Queue a remote uninstall of one app across every accessible device. MSP staff
// only; scoped to the caller's orgs. Devices that don't have the app installed
// simply report "not found" — the agent uninstall is best-effort.
export async function POST(req: NextRequest, { params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params
  const supabase = await createServerClient()
  const profile = await getCallerProfile(supabase)
  if (!profile || !isMspStaff(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data: app } = await admin.from('apps').select('id, name').eq('id', appId).single()
  if (!app) return NextResponse.json({ error: 'App not found' }, { status: 404 })

  const orgIds = await getAccessibleOrgIds(supabase, profile)
  let dq = admin.from('devices').select('device_id, org_id')
  if (orgIds !== null) dq = dq.in('org_id', orgIds.length ? orgIds : [NO_MATCH])
  const { data: devices, error: devErr } = await dq
  if (devErr) return NextResponse.json({ error: devErr.message }, { status: 400 })
  if (!devices?.length) return NextResponse.json({ success: true, queued: 0 })

  const rows = devices.map(d => ({
    device_id: d.device_id, type: 'uninstall_app', app_id: appId,
    org_id: d.org_id, created_by: profile.id,
  }))
  // Bulk-insert in chunks so a very large fleet doesn't exceed request limits.
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await admin.from('device_commands').insert(rows.slice(i, i + CHUNK))
    if (error) return NextResponse.json({ error: error.message, queued: i }, { status: 400 })
  }

  return NextResponse.json({ success: true, queued: rows.length, app: app.name })
}
