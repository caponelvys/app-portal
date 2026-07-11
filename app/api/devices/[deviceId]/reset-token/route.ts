import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, isMspStaff, getAccessibleOrgIds } from '@/lib/rbac'

// Clear a device's token_hash so its agent can mint a fresh credential on its next
// enroll. Recovery path for a device that lost its local .device_token (a device
// with a token_hash set won't be re-issued one by a bare enroll). MSP staff only,
// scoped to an accessible org.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = await params
  const supabase = await createServerClient()
  const profile = await getCallerProfile(supabase)
  if (!profile || !isMspStaff(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data: device } = await admin
    .from('devices')
    .select('org_id')
    .eq('device_id', deviceId)
    .maybeSingle()
  if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 })

  const orgIds = await getAccessibleOrgIds(supabase, profile)
  if (orgIds !== null && (!device.org_id || !orgIds.includes(device.org_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await admin
    .from('devices')
    .update({ token_hash: null, token_issued_at: null })
    .eq('device_id', deviceId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
