import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

async function getUser() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// List the caller's claimed devices and any unclaimed devices they could claim.
export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('devices')
    .select('device_id, hostname, os, last_seen, user_id')
    .order('last_seen', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const mine = (data ?? []).filter(d => d.user_id === user.id)
  const unclaimed = (data ?? []).filter(d => !d.user_id)
  return NextResponse.json({ mine, unclaimed })
}

// Claim an unclaimed device, or release one the caller owns.
export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { device_id, action } = await req.json()
  if (!device_id) return NextResponse.json({ error: 'device_id is required' }, { status: 400 })

  const admin = createAdminClient()

  if (action === 'release') {
    const { error } = await admin
      .from('devices')
      .update({ user_id: null })
      .eq('device_id', device_id)
      .eq('user_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  }

  // Claim: only allowed if the device is not already owned by someone else.
  const { data: device, error: fetchError } = await admin
    .from('devices')
    .select('user_id')
    .eq('device_id', device_id)
    .single()
  if (fetchError || !device) return NextResponse.json({ error: 'Device not found' }, { status: 404 })
  if (device.user_id && device.user_id !== user.id) {
    return NextResponse.json({ error: 'Device is already claimed by another user' }, { status: 409 })
  }

  const { error } = await admin
    .from('devices')
    .update({ user_id: user.id })
    .eq('device_id', device_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
