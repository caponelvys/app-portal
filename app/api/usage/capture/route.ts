import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'
import { captureSnapshots, monthStart, periodOf } from '@/lib/metering'

// Manual "capture this month" — snapshots the current month's counts for ALL
// orgs, so it's restricted to msp_admin (all-orgs); a scoped tech shouldn't
// trigger billing writes for orgs they don't manage.
export async function POST() {
  const supabase = await createServerClient()
  const profile = await getCallerProfile(supabase)
  if (!profile || !isMspStaff(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgIds = await getAccessibleOrgIds(supabase, profile)
  if (orgIds !== null) return NextResponse.json({ error: 'Only an MSP admin can capture usage snapshots' }, { status: 403 })

  const now = new Date()
  const since = monthStart(now)
  const until = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  const result = await captureSnapshots(createAdminClient(), periodOf(now), since, until)
  return NextResponse.json({ success: true, ...result })
}
