import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const { token, device_id, hostname, os, location_id: existingLocId } = await req.json()

  if (!device_id) return NextResponse.json({ error: 'device_id required' }, { status: 400 })

  const admin = createAdminClient()

  // Resolve token → location if provided
  let locationId: string | null = existingLocId ?? null
  let orgId: string | null = null

  if (token) {
    const { data: loc } = await admin
      .from('locations')
      .select('id, org_id')
      .eq('enrollment_token', token)
      .single()

    if (!loc) return NextResponse.json({ error: 'Invalid enrollment token' }, { status: 404 })
    locationId = loc.id
    orgId = loc.org_id
  }

  // Upsert the device row
  const patch: Record<string, string | null> = {
    device_id,
    hostname: hostname ?? null,
    os: os ?? null,
    last_seen: new Date().toISOString(),
  }
  if (locationId) patch.location_id = locationId
  if (orgId)     patch.org_id      = orgId

  const { error } = await admin
    .from('devices')
    .upsert(patch, { onConflict: 'device_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, location_id: locationId, org_id: orgId })
}
