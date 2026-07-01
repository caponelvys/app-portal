import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, isMspStaff } from '@/lib/rbac'

// Queue a remote command for the device's agent to pick up on its next cycle.
// MSP staff only. The agent (v1.5.0+) reads devices.pending_command, runs it,
// and clears it.
const VALID = ['restart', 'update', 'uninstall'] as const

export async function POST(req: NextRequest, { params }: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = await params
  const supabase = await createServerClient()
  const profile = await getCallerProfile(supabase)
  if (!profile || !isMspStaff(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { command } = await req.json()
  if (!VALID.includes(command)) {
    return NextResponse.json({ error: 'command must be one of: restart, update, uninstall' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('devices').update({ pending_command: command }).eq('device_id', deviceId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true, command })
}
