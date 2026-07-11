import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { mintDeviceToken } from '@/lib/agentAuth'

// Device enrollment + credential minting.
//
// The agent calls this on first run (and again any time it has no local token).
// We resolve the location enrollment token → org/location, upsert the device row,
// and — if the device has no token_hash yet — mint a per-device bearer token,
// returning it ONCE. That single response is the only time the secret exists in
// the clear; only its sha256 is stored. Covers both a brand-new enrollment and
// backfilling a previously-enrolled (tokenless) device.
//
// A device that ALREADY has a token_hash does not get a fresh token from a bare
// enroll — otherwise anyone holding the (shared) location token could re-mint and
// hijack an enrolled device's identity. Recovery for a device that lost its local
// token is an admin token reset (clears token_hash), then re-enroll. The residual
// trust-on-first-use window (location-token holder races the real agent before it
// first tokenizes) is unchanged from the pre-token model and accepted.
export async function POST(req: NextRequest) {
  const { token, device_id, hostname, os, location_id: existingLocId, pairing_code } = await req.json()

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

  // Existing state for this device (token + claim), so we only mint once and only
  // publish a pairing code while the device is unclaimed.
  const { data: existing } = await admin
    .from('devices')
    .select('user_id, token_hash')
    .eq('device_id', device_id)
    .maybeSingle()

  // Upsert the device row
  const patch: Record<string, string | null> = {
    device_id,
    hostname: hostname ?? null,
    os: os ?? null,
    last_seen: new Date().toISOString(),
  }
  if (locationId) patch.location_id = locationId
  if (orgId)     patch.org_id      = orgId
  // Publish the agent's pairing code only while unclaimed (the claim flow clears it).
  if (pairing_code && !existing?.user_id) patch.pairing_code = pairing_code

  // Mint a token when the device has none yet (new enroll OR backfill).
  let deviceToken: string | null = null
  if (!existing?.token_hash) {
    const minted = mintDeviceToken()
    deviceToken = minted.token
    patch.token_hash = minted.hash
    patch.token_issued_at = new Date().toISOString()
  }

  const { error } = await admin
    .from('devices')
    .upsert(patch, { onConflict: 'device_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    location_id: locationId,
    org_id: orgId,
    user_id: existing?.user_id ?? null,
    // Present only on the mint (first enroll / backfill). The agent persists it.
    ...(deviceToken ? { device_token: deviceToken } : {}),
  })
}
