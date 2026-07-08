import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, isMspStaff } from '@/lib/rbac'
import { enqueueAppCommand } from '@/lib/deviceCommands'

// Queue an elevated launch of one app on a single device. MSP staff only. The
// app must be marked elevation-eligible (allow_elevation); the agent runs it
// with elevated privileges in the user session without granting local admin.
export async function POST(req: NextRequest, { params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params
  const supabase = await createServerClient()
  const profile = await getCallerProfile(supabase)
  if (!profile || !isMspStaff(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { deviceId } = await req.json().catch(() => ({})) as { deviceId?: string }
  if (!deviceId) return NextResponse.json({ error: 'deviceId is required' }, { status: 400 })

  const { data: app } = await createAdminClient().from('apps').select('allow_elevation').eq('id', appId).single()
  if (!app?.allow_elevation) {
    return NextResponse.json({ error: 'This app is not approved for elevated run' }, { status: 400 })
  }

  const res = await enqueueAppCommand({ appId, type: 'elevate_app', scope: 'device', scopeId: deviceId, profile, supabase })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
  return NextResponse.json({ success: true, queued: res.queued, app: res.app })
}
