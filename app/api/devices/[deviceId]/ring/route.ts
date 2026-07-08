import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'

// Assign a device to a ring (or clear it with ring_id: null). The ring must
// belong to the device's org.
export async function POST(req: NextRequest, { params }: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = await params
  const supabase = await createServerClient()
  const profile = await getCallerProfile(supabase)
  if (!profile || !isMspStaff(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { ring_id } = await req.json()
  const admin = createAdminClient()

  const { data: device } = await admin.from('devices').select('device_id, org_id').eq('device_id', deviceId).maybeSingle()
  if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 })

  const orgIds = await getAccessibleOrgIds(supabase, profile)
  if (orgIds !== null && (!device.org_id || !orgIds.includes(device.org_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (ring_id) {
    const { data: ring } = await admin.from('rings').select('org_id').eq('id', ring_id).maybeSingle()
    if (!ring || ring.org_id !== device.org_id) {
      return NextResponse.json({ error: 'Ring must belong to the device’s organization' }, { status: 400 })
    }
  }

  const { error } = await admin.from('devices').update({ ring_id: ring_id ?? null }).eq('device_id', deviceId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true, ring_id: ring_id ?? null })
}
