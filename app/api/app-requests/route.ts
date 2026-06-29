import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { expiryFromDuration, isValidDuration } from '@/lib/durations'
import { sendAccessDecisionEmail, sendAccessRevokedEmail } from '@/lib/email'
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

  const { error } = await admin.from('app_requests').insert({
    app_id,
    user_id: user.id,
    reason: reason?.trim() || null,
    duration: grantDuration,
    status: 'pending',
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

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
  const appIds = [...new Set((requests ?? []).map(r => r.app_id))]
  const { data: apps } = appIds.length
    ? await admin.from('apps').select('id, name, icon_url').in('id', appIds)
    : { data: [] }
  const appMap = new Map((apps ?? []).map(a => [a.id, a]))

  let emailMap = new Map<string, string>()
  if (role === 'admin') {
    const userIds = [...new Set((requests ?? []).map(r => r.user_id))]
    const { data: profiles } = userIds.length
      ? await admin.from('profiles').select('id, email').in('id', userIds)
      : { data: [] }
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

// Admin approves or denies a request.
export async function PATCH(req: NextRequest) {
  const { user, role } = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, action } = await req.json()
  if (!id || (action !== 'approve' && action !== 'deny' && action !== 'revoke')) {
    return NextResponse.json({ error: 'id and a valid action (approve|deny|revoke) are required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: request, error: fetchError } = await admin
    .from('app_requests')
    .select('id, duration, user_id, app_id')
    .eq('id', id)
    .single()
  if (fetchError || !request) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

  const reviewedAt = new Date().toISOString()
  const expiresAt = action === 'approve' ? expiryFromDuration(request.duration) : null
  const update =
    action === 'approve'
      ? { status: 'approved', expires_at: expiresAt, reviewed_by: user.id, reviewed_at: reviewedAt }
      : action === 'deny'
        ? { status: 'denied', reviewed_by: user.id, reviewed_at: reviewedAt }
        : { status: 'revoked', reviewed_by: user.id, reviewed_at: reviewedAt }

  const { error } = await admin.from('app_requests').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

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

  return NextResponse.json({ success: true })
}
