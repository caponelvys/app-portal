import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { expiryFromDuration, isValidDuration } from '@/lib/durations'
import { sendAccessDecisionEmail, sendAccessRevokedEmail, sendAccessRequestedEmail } from '@/lib/email'
import { expireGrants } from '@/lib/expireGrants'

// Resolve the signed-in user and their role from the request cookies.
async function getSession() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, role: null as string | null }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return { user, role: (profile?.role as string) ?? 'user' }
}

// User submits a request for access to a (blocked) app.
export async function POST(req: NextRequest) {
  const { user } = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { app_id, reason, duration } = await req.json()
  if (!app_id) return NextResponse.json({ error: 'app_id is required' }, { status: 400 })
  const grantDuration = isValidDuration(duration) ? duration : 'permanent'

  const admin = createAdminClient()

  // Don't allow a second pending request for the same app.
  const { data: existing } = await admin
    .from('app_requests')
    .select('id')
    .eq('app_id', app_id)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle()
  if (existing) return NextResponse.json({ error: 'You already have a pending request for this app' }, { status: 409 })

  const cleanReason = reason?.trim() || null
  const { error } = await admin.from('app_requests').insert({
    app_id,
    user_id: user.id,
    reason: cleanReason,
    duration: grantDuration,
    status: 'pending',
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Notify MSP staff (admins + techs) of the new request. Best-effort —
  // failure here must not fail the request submission itself.
  try {
    const [{ data: app }, { data: staff }, { data: me }] = await Promise.all([
      admin.from('apps').select('name').eq('id', app_id).single(),
      admin.from('profiles').select('email, role, role_v2').or('role.eq.admin,role_v2.in.(msp_admin,msp_tech)'),
      admin.from('profiles').select('email').eq('id', user.id).single(),
    ])
    const recipients = [...new Set((staff ?? []).map(s => s.email).filter(Boolean))] as string[]
    if (recipients.length) {
      await sendAccessRequestedEmail({
        to: recipients,
        appName: app?.name ?? 'an app',
        requesterEmail: me?.email ?? 'A user',
        duration: grantDuration,
        reason: cleanReason,
      })
    }
  } catch (e) {
    console.error('[app-requests] staff notification failed', e)
  }

  return NextResponse.json({ success: true })
}

// List requests. Admins see everything (with requester email); users see their own.
export async function GET() {
  const { user, role } = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  await expireGrants(admin)

  let query = admin
    .from('app_requests')
    .select('id, app_id, user_id, reason, duration, status, expires_at, reviewed_at, created_at')
    .order('created_at', { ascending: false })
  if (role !== 'admin') query = query.eq('user_id', user.id)

  const { data: requests, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Attach app names and (for admins) requester emails without relying on
  // PostgREST embedding, so the route works regardless of FK cache state.
  // These lookups must not fail silently: a permission/query error here would
  // otherwise surface as bogus "Unknown app" rows and hide the real problem.
  const appIds = [...new Set((requests ?? []).map(r => r.app_id))]
  const { data: apps, error: appsError } = appIds.length
    ? await admin.from('apps').select('id, name, icon_url').in('id', appIds)
    : { data: [], error: null }
  if (appsError) return NextResponse.json({ error: `Failed to load apps: ${appsError.message}` }, { status: 500 })
  const appMap = new Map((apps ?? []).map(a => [a.id, a]))

  let emailMap = new Map<string, string>()
  if (role === 'admin') {
    const userIds = [...new Set((requests ?? []).map(r => r.user_id))]
    const { data: profiles, error: profilesError } = userIds.length
      ? await admin.from('profiles').select('id, email').in('id', userIds)
      : { data: [], error: null }
    if (profilesError) return NextResponse.json({ error: `Failed to load users: ${profilesError.message}` }, { status: 500 })
    emailMap = new Map((profiles ?? []).map(p => [p.id, p.email]))
  }

  const enriched = (requests ?? []).map(r => ({
    ...r,
    app_name: appMap.get(r.app_id)?.name ?? 'Unknown app',
    app_icon_url: appMap.get(r.app_id)?.icon_url ?? null,
    user_email: emailMap.get(r.user_id) ?? null,
  }))

  return NextResponse.json({ requests: enriched, isAdmin: role === 'admin' })
}

// User cancels their own still-pending request for an app (removes it from the
// admin queue). Only pending requests owned by the caller are affected.
export async function DELETE(req: NextRequest) {
  const { user } = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { app_id } = await req.json().catch(() => ({}))
  if (!app_id) return NextResponse.json({ error: 'app_id is required' }, { status: 400 })
  const admin = createAdminClient()
  const { error } = await admin
    .from('app_requests')
    .delete()
    .eq('user_id', user.id)
    .eq('app_id', app_id)
    .eq('status', 'pending')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}

// Apply a single approve/deny/revoke decision and notify the requester.
async function applyDecision(
  admin: ReturnType<typeof createAdminClient>,
  reviewerId: string,
  id: string,
  action: 'approve' | 'deny' | 'revoke',
): Promise<{ ok: boolean; error?: string }> {
  const { data: request, error: fetchError } = await admin
    .from('app_requests')
    .select('id, duration, user_id, app_id')
    .eq('id', id)
    .single()
  if (fetchError || !request) return { ok: false, error: 'Request not found' }

  const reviewedAt = new Date().toISOString()
  const expiresAt = action === 'approve' ? expiryFromDuration(request.duration) : null
  const update =
    action === 'approve'
      ? { status: 'approved', expires_at: expiresAt, reviewed_by: reviewerId, reviewed_at: reviewedAt }
      : action === 'deny'
        ? { status: 'denied', reviewed_by: reviewerId, reviewed_at: reviewedAt }
        : { status: 'revoked', reviewed_by: reviewerId, reviewed_at: reviewedAt }

  const { error } = await admin.from('app_requests').update(update).eq('id', id)
  if (error) return { ok: false, error: error.message }

  // Notify the requester. Failure here must not fail the decision itself.
  try {
    const [{ data: profile }, { data: app }] = await Promise.all([
      admin.from('profiles').select('email').eq('id', request.user_id).single(),
      admin.from('apps').select('name').eq('id', request.app_id).single(),
    ])
    if (profile?.email) {
      const appName = app?.name ?? 'an app'
      if (action === 'revoke') {
        await sendAccessRevokedEmail({ to: profile.email, appName })
      } else {
        await sendAccessDecisionEmail({
          to: profile.email,
          appName,
          approved: action === 'approve',
          duration: request.duration,
          expiresAt,
        })
      }
    }
  } catch (e) {
    console.error('[app-requests] notification failed', e)
  }

  return { ok: true }
}

// Admin approves/denies/revokes one request (`id`) or many at once (`ids`).
export async function PATCH(req: NextRequest) {
  const { user, role } = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, ids, action } = await req.json()
  if (action !== 'approve' && action !== 'deny' && action !== 'revoke') {
    return NextResponse.json({ error: 'a valid action (approve|deny|revoke) is required' }, { status: 400 })
  }
  const targetIds: string[] = Array.isArray(ids) ? ids.filter(Boolean) : id ? [id] : []
  if (targetIds.length === 0) {
    return NextResponse.json({ error: 'id or ids is required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const results = await Promise.all(targetIds.map(t => applyDecision(admin, user.id, t, action)))
  const failed = results.filter(r => !r.ok)
  if (failed.length === targetIds.length) {
    return NextResponse.json({ error: failed[0]?.error ?? 'Action failed' }, { status: 400 })
  }

  return NextResponse.json({ success: true, processed: targetIds.length - failed.length, failed: failed.length })
}
