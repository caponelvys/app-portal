import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, isMspStaff } from '@/lib/rbac'

// Reset (remove all MFA factors for) a user — for lockout recovery.
// Restricted to MSP staff. The target is logged out of active sessions.
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const caller = await getCallerProfile(supabase)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isMspStaff(caller)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { user_id } = await req.json()
  if (!user_id) return NextResponse.json({ error: 'user_id is required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId: user_id })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  let removed = 0
  for (const factor of data?.factors ?? []) {
    const { error: delErr } = await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId: user_id })
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 })
    removed++
  }

  return NextResponse.json({ success: true, removed })
}
