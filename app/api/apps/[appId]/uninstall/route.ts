import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, isMspStaff, getAccessibleOrgIds } from '@/lib/rbac'

const NO_MATCH = '00000000-0000-0000-0000-000000000000'
const CHUNK = 500
const SCOPES = ['device', 'location', 'org', 'fleet'] as const
type Scope = (typeof SCOPES)[number]

// Queue a remote uninstall of one app across a chosen scope: a single device, a
// location, an org, or the whole (accessible) fleet. MSP staff only; every scope
// is checked against the caller's accessible orgs. The agent picks the commands
// up from device_commands, uninstalls, and writes results back.
export async function POST(req: NextRequest, { params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params
  const supabase = await createServerClient()
  const profile = await getCallerProfile(supabase)
  if (!profile || !isMspStaff(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { scope, scopeId } = await req.json().catch(() => ({})) as { scope?: Scope; scopeId?: string }
  if (!scope || !SCOPES.includes(scope)) {
    return NextResponse.json({ error: `scope must be one of: ${SCOPES.join(', ')}` }, { status: 400 })
  }
  if (scope !== 'fleet' && !scopeId) {
    return NextResponse.json({ error: 'scopeId is required for this scope' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: app } = await admin.from('apps').select('id, name').eq('id', appId).single()
  if (!app) return NextResponse.json({ error: 'App not found' }, { status: 404 })

  const orgIds = await getAccessibleOrgIds(supabase, profile)  // null = all orgs
  const accessible = (oid: string | null | undefined) => orgIds === null || (!!oid && orgIds.includes(oid))

  // Resolve the target device set for the scope, enforcing access.
  let devices: { device_id: string; org_id: string | null }[] = []
  if (scope === 'device') {
    const { data: d } = await admin.from('devices').select('device_id, org_id').eq('device_id', scopeId!).single()
    if (!d) return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    if (!accessible(d.org_id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    devices = [d]
  } else if (scope === 'org') {
    if (!accessible(scopeId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { data } = await admin.from('devices').select('device_id, org_id').eq('org_id', scopeId!)
    devices = data ?? []
  } else if (scope === 'location') {
    const { data: loc } = await admin.from('locations').select('id, org_id').eq('id', scopeId!).single()
    if (!loc) return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    if (!accessible(loc.org_id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { data } = await admin.from('devices').select('device_id, org_id').eq('location_id', scopeId!)
    devices = data ?? []
  } else {
    // fleet: every accessible device
    let dq = admin.from('devices').select('device_id, org_id')
    if (orgIds !== null) dq = dq.in('org_id', orgIds.length ? orgIds : [NO_MATCH])
    const { data } = await dq
    devices = data ?? []
  }

  if (!devices.length) return NextResponse.json({ success: true, queued: 0, app: app.name })

  const rows = devices.map(d => ({
    device_id: d.device_id, type: 'uninstall_app', app_id: appId,
    org_id: d.org_id, created_by: profile.id,
  }))
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await admin.from('device_commands').insert(rows.slice(i, i + CHUNK))
    if (error) return NextResponse.json({ error: error.message, queued: i }, { status: 400 })
  }

  return NextResponse.json({ success: true, queued: rows.length, app: app.name })
}
