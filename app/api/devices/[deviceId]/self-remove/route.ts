import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { archiveDevice } from '@/lib/deviceArchive'
import { authenticateDevice } from '@/lib/agentAuth'

// Called by the agent as its final act during self-uninstall, so the device
// disappears from the portal automatically. Authenticated with the device's own
// bearer token (the agent has no user session) — and the token must match the
// device being removed, so one device can't delete another. Idempotent; removes
// the device row + its pending commands (audit history is kept).
export async function POST(req: NextRequest, { params }: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = await params
  const admin = createAdminClient()

  const device = await authenticateDevice(req, admin)
  if (!device || device.device_id !== deviceId) {
    return NextResponse.json({ error: 'invalid device token' }, { status: 401 })
  }

  // Preserve the device's name/org for historical Reports before the row is gone.
  await archiveDevice(admin, deviceId)
  await admin.from('device_commands').delete().eq('device_id', deviceId)
  await admin.from('devices').delete().eq('device_id', deviceId)
  return NextResponse.json({ success: true })
}
