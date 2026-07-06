import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { archiveDevice } from '@/lib/deviceArchive'

// Called by the agent as its final act during self-uninstall, so the device
// disappears from the portal automatically. Unauthenticated (the agent has no
// session) — like /api/enroll. Idempotent; only removes the device row + its
// pending commands (audit history is kept). Low-risk: a device whose agent is
// still alive would just re-enroll on its next heartbeat.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = await params
  const admin = createAdminClient()
  // Preserve the device's name/org for historical Reports before the row is gone.
  await archiveDevice(admin, deviceId)
  await admin.from('device_commands').delete().eq('device_id', deviceId)
  await admin.from('devices').delete().eq('device_id', deviceId)
  return NextResponse.json({ success: true })
}
