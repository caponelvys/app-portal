import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { isValidDuration, isGrantActive } from '@/lib/durations'
import { sendAccessRequestedEmail } from '@/lib/email'

// Device-authenticated app-access requests, submitted by the Ravyn Companion
// running in the user's session. Unlike /api/app-requests (cookie session), this
// authenticates by `device_id` and files the request on behalf of the device's
// assigned owner. device_id is not a secret (the anon key is already embedded in
// the agent) and every request is admin-approved, so the trust model matches the
// agent's. app_requests requires the service-role client — see lib/supabase-admin.

type DeviceOwner = { user_id: string | null; org_id: string | null }

async function resolveDevice(admin: ReturnType<typeof createAdminClient>, deviceId: string) {
  const { data } = await admin
    .from('devices')
    .select('user_id, org_id')
    .eq('device_id', deviceId)
    .maybeSingle()
  return (data as DeviceOwner | null) ?? null
}

// GET /api/device-request?device_id=…  →  requestable (blocked) apps + this
// owner's current request status per app, so the companion can render the list.
export async function GET(req: NextRequest) {
  const deviceId = req.nextUrl.searchParams.get('device_id')
  if (!deviceId) return NextResponse.json({ error: 'device_id is required' }, { status: 400 })

  const admin = createAdminClient()
  const device = await resolveDevice(admin, deviceId)
  if (!device) return NextResponse.json({ error: 'Unknown device' }, { status: 404 })
  if (!device.user_id) {
    return NextResponse.json(
      { error: 'This device isn’t assigned to a user yet. Ask your administrator to set the owner.' },
      { status: 409 },
    )
  }

  const [{ data: blockedApps }, { data: myRequests }] = await Promise.all([
    admin.from('apps').select('id, name, description, icon_url').eq('status', 'blocked').order('name'),
    admin
      .from('app_requests')
      .select('app_id, status, expires_at')
      .eq('user_id', device.user_id)
      .order('created_at', { ascending: false }),
  ])

  // Latest request per app (rows already newest-first).
  const latest = new Map<string, { status: string; expires_at: string | null }>()
  for (const r of myRequests ?? []) {
    if (!latest.has(r.app_id)) latest.set(r.app_id, { status: r.status, expires_at: r.expires_at })
  }

  const apps = (blockedApps ?? [])
    .filter(a => {
      const req = latest.get(a.id)
      return !(req && isGrantActive(req.status, req.expires_at)) // hide apps already granted
    })
    .map(a => {
      const req = latest.get(a.id)
      let requestStatus: 'none' | 'pending' | 'denied' | 'expired' = 'none'
      if (req?.status === 'pending') requestStatus = 'pending'
      else if (req?.status === 'denied') requestStatus = 'denied'
      else if (req?.status === 'expired' || req?.status === 'approved') requestStatus = 'expired'
      return { id: a.id, name: a.name, description: a.description, icon_url: a.icon_url, requestStatus }
    })

  return NextResponse.json({ apps })
}

// POST /api/device-request  { device_id, app_id, reason, duration }
// Files an access request for the device's owner.
export async function POST(req: NextRequest) {
  const { device_id, app_id, reason, duration } = await req.json()
  if (!device_id) return NextResponse.json({ error: 'device_id is required' }, { status: 400 })
  if (!app_id) return NextResponse.json({ error: 'app_id is required' }, { status: 400 })

  const admin = createAdminClient()
  const device = await resolveDevice(admin, device_id)
  if (!device) return NextResponse.json({ error: 'Unknown device' }, { status: 404 })
  if (!device.user_id) {
    return NextResponse.json(
      { error: 'This device isn’t assigned to a user yet. Ask your administrator to set the owner.' },
      { status: 409 },
    )
  }

  const grantDuration = isValidDuration(duration) ? duration : 'permanent'

  // The app must exist and be blocked (nothing to request otherwise).
  const { data: app } = await admin.from('apps').select('id, name, status').eq('id', app_id).maybeSingle()
  if (!app) return NextResponse.json({ error: 'Unknown app' }, { status: 404 })
  if (app.status !== 'blocked') {
    return NextResponse.json({ error: 'That app isn’t blocked — no request needed.' }, { status: 400 })
  }

  // No duplicate pending request for the same app/owner.
  const { data: existing } = await admin
    .from('app_requests')
    .select('id')
    .eq('app_id', app_id)
    .eq('user_id', device.user_id)
    .eq('status', 'pending')
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ error: 'You already have a pending request for this app.' }, { status: 409 })
  }

  const cleanReason = reason?.trim() || null
  const { error } = await admin.from('app_requests').insert({
    app_id,
    user_id: device.user_id,
    reason: cleanReason,
    duration: grantDuration,
    status: 'pending',
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Best-effort: notify MSP staff, mirroring /api/app-requests. Never fail the
  // submission on a notification error.
  try {
    const [{ data: staff }, { data: me }] = await Promise.all([
      admin.from('profiles').select('email, role, role_v2').or('role.eq.admin,role_v2.in.(msp_admin,msp_tech)'),
      admin.from('profiles').select('email').eq('id', device.user_id).single(),
    ])
    const recipients = [...new Set((staff ?? []).map(s => s.email).filter(Boolean))] as string[]
    if (recipients.length) {
      await sendAccessRequestedEmail({
        to: recipients,
        appName: app.name ?? 'an app',
        requesterEmail: me?.email ?? 'A user',
        duration: grantDuration,
        reason: cleanReason,
      })
    }
  } catch (e) {
    console.error('[device-request] staff notification failed', e)
  }

  return NextResponse.json({ success: true })
}
