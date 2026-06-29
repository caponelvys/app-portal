import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

async function getUser() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// List the caller's claimed devices.
export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('devices')
    .select('device_id, hostname, os, last_seen')
    .eq('user_id', user.id)
    .order('last_seen', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ mine: data ?? [] })
}

// Pair (claim) a device using the code shown by the agent, or release one.
export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, code, device_id } = await req.json()
  const admin = createAdminClient()

  if (action === 'release') {
    if (!device_id) return NextResponse.json({ error: 'device_id is required' }, { status: 400 })
    const { error } = await admin
      .from('devices')
      .update({ user_id: null })
      .eq('device_id', device_id)
      .eq('user_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  }

  // Pair by code (default action).
  const normalized = typeof code === 'string' ? code.trim().toUpperCase() : ''
  if (!normalized) return NextResponse.json({ error: 'A pairing code is required' }, { status: 400 })

  const { data: device, error: lookupError } = await admin
    .from('devices')
    .select('device_id, user_id, hostname')
    .eq('pairing_code', normalized)
    .maybeSingle()
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 400 })
  if (!device) return NextResponse.json({ error: 'Invalid or expired pairing code' }, { status: 404 })
  if (device.user_id && device.user_id !== user.id) {
    return NextResponse.json({ error: 'That device is already claimed by another user' }, { status: 409 })
  }

  // Claim the device and consume the one-time code.
  const { error } = await admin
    .from('devices')
    .update({ user_id: user.id, pairing_code: null })
    .eq('device_id', device.device_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true, hostname: device.hostname })
}
