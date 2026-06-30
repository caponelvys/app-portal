import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { getCallerProfile, isMspStaff } from '@/lib/rbac'
import { createAdminClient } from '@/lib/supabase-admin'

const VALID_ROLES = ['msp_admin', 'msp_tech', 'client_admin', 'client_user', 'admin', 'user']

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const profile = await getCallerProfile(supabase)
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isMspStaff(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, role, org_id } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

  const safeRole = VALID_ROLES.includes(role) ? role : 'client_user'

  const adminClient = createAdminClient()

  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { role: safeRole, org_id: org_id ?? null },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Stamp org_id + role_v2 on the profile row if it already exists
  if (data.user) {
    const updateData: Record<string, string | null> = { role_v2: safeRole }
    if (org_id) updateData.org_id = org_id
    // Legacy role column
    updateData.role = ['msp_admin', 'admin'].includes(safeRole) ? 'admin' : 'user'

    await adminClient
      .from('profiles')
      .update(updateData)
      .eq('id', data.user.id)
  }

  return NextResponse.json({ success: true, user: data.user })
}
