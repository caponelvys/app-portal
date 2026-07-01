import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, isMspStaff } from '@/lib/rbac'

// Set or clear a device's owner (user_id). MSP staff only. Used to accept an
// auto-suggested owner (or clear one). Assigning consumes any pairing code.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = await params
  const supabase = await createServerClient()
  const profile = await getCallerProfile(supabase)
  if (!profile || !isMspStaff(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { user_id } = await req.json()
  const admin = createAdminClient()

  if (!user_id) {
    const { error } = await admin.from('devices').update({ user_id: null }).eq('device_id', deviceId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true, user_id: null })
  }

  const { data: target } = await admin.from('profiles').select('id, email').eq('id', user_id).maybeSingle()
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 400 })

  const { error } = await admin
    .from('devices')
    .update({ user_id, pairing_code: null })
    .eq('device_id', deviceId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true, user_id, email: target.email })
}
