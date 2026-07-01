import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, isMspStaff } from '@/lib/rbac'

// Lightweight count of pending access requests, for the admin nav badge.
// MSP staff only; returns { count }.
export async function GET() {
  const supabase = await createServerClient()
  const profile = await getCallerProfile(supabase)
  if (!profile || !isMspStaff(profile)) {
    return NextResponse.json({ count: 0 })
  }

  const admin = createAdminClient()
  const { count, error } = await admin
    .from('app_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  if (error) return NextResponse.json({ count: 0 })
  return NextResponse.json({ count: count ?? 0 })
}
