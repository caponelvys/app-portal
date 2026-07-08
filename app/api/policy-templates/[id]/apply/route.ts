import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'
import { scopeOrgId } from '@/lib/policyHistory'
import { applyTemplate } from '@/lib/policyTemplates'

const SCOPES = ['org', 'location', 'device', 'ring']

// Apply a template to a scope: its items become app_policies there (logged to
// history). Merges — apps not in the template keep their current policy.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const profile = await getCallerProfile(supabase)
  if (!profile || !isMspStaff(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { scope_type, scope_id } = await req.json()
  if (!SCOPES.includes(scope_type) || !scope_id) {
    return NextResponse.json({ error: 'valid scope_type and scope_id are required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const org = await scopeOrgId(admin, scope_type, scope_id)
  if (!org) return NextResponse.json({ error: 'Scope target not found' }, { status: 404 })
  const orgIds = await getAccessibleOrgIds(supabase, profile)
  if (orgIds !== null && !orgIds.includes(org)) {
    return NextResponse.json({ error: 'No access to that scope' }, { status: 403 })
  }

  const { data: tmpl } = await admin.from('policy_templates').select('id').eq('id', id).maybeSingle()
  if (!tmpl) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

  const result = await applyTemplate(admin, id, scope_type, scope_id, profile.id)
  return NextResponse.json({ success: true, ...result })
}
