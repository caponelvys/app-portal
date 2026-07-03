import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, isMspStaff, getAccessibleOrgIds } from '@/lib/rbac'

// Queue a remote uninstall of one app on one device. MSP staff only; the caller
// must have access to the device's org. The agent picks the command up from the
// device_commands queue, uninstalls, and writes the result back.
export async function POST(req: NextRequest, { params }: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = await params
  const supabase = await createServerClient()
  const profile = await getCallerProfile(supabase)
  if (!profile || !isMspStaff(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { appId } = await req.json().catch(() => ({}))
  if (!appId) return NextResponse.json({ error: 'appId is required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: device } = await admin.from('devices').select('device_id, org_id').eq('device_id', deviceId).single()
  if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 })

  const orgIds = await getAccessibleOrgIds(supabase, profile)
  if (orgIds !== null && (!device.org_id || !orgIds.includes(device.org_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: app } = await admin.from('apps').select('id, name').eq('id', appId).single()
  if (!app) return NextResponse.json({ error: 'App not found' }, { status: 404 })

  const { error } = await admin.from('device_commands').insert({
    device_id: deviceId, type: 'uninstall_app', app_id: appId,
    org_id: device.org_id, created_by: profile.id,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true, app: app.name })
}
