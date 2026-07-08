import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, isMspStaff } from '@/lib/rbac'
import { captureSnapshots, monthStart, periodOf } from '@/lib/metering'

// Manual "capture this month" — snapshots the current month's counts for all
// orgs (active = checked in since the 1st). msp-staff only.
export async function POST() {
  const supabase = await createServerClient()
  const profile = await getCallerProfile(supabase)
  if (!profile || !isMspStaff(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const now = new Date()
  const since = monthStart(now)
  const until = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  const result = await captureSnapshots(createAdminClient(), periodOf(now), since, until)
  return NextResponse.json({ success: true, ...result })
}
