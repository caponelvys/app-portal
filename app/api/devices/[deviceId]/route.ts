import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, isMspStaff, getAccessibleOrgIds } from '@/lib/rbac'
import { archiveDevice } from '@/lib/deviceArchive'

// Remove a device's record from the portal (for decommissioned/uninstalled
// machines). MSP staff only, org-scoped. Deletes the devices row + any pending
// commands; leaves agent_logs/agent_events as historical audit. If the agent is
// still installed it will simply re-enroll on its next heartbeat.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = await params
  const supabase = await createServerClient()
  const profile = await getCallerProfile(supabase)
  if (!profile || !isMspStaff(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data: device } = await admin.from('devices').select('device_id, org_id').eq('device_id', deviceId).single()
  if (!device) return NextResponse.json({ success: true })  // already gone

  const orgIds = await getAccessibleOrgIds(supabase, profile)
  if (orgIds !== null && (!device.org_id || !orgIds.includes(device.org_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Preserve the device's name/org for historical Reports before the row is gone.
  await archiveDevice(admin, deviceId)
  await admin.from('device_commands').delete().eq('device_id', deviceId)
  const { error } = await admin.from('devices').delete().eq('device_id', deviceId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
