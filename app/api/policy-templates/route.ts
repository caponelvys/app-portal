import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'
import { scopeOrgId } from '@/lib/policyHistory'
import { captureScopeItems } from '@/lib/policyTemplates'

const SCOPES = ['org', 'location', 'device', 'ring']

async function caller() {
  const supabase = await createServerClient()
  const profile = await getCallerProfile(supabase)
  if (!profile || !isMspStaff(profile)) return null
  return { supabase, profile }
}

// Create a template. When from_scope is given, seed its items from that scope's
// current overrides ("save this org's policy as a template").
export async function POST(req: NextRequest) {
  const c = await caller()
  if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, description, from_scope_type, from_scope_id } = await req.json()
  if (!(name || '').trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const admin = createAdminClient()
  let items: { app_id: string; status: string }[] = []

  if (from_scope_type || from_scope_id) {
    if (!SCOPES.includes(from_scope_type) || !from_scope_id) {
      return NextResponse.json({ error: 'valid from_scope_type and from_scope_id required to capture' }, { status: 400 })
    }
    // Capturing reads a scope's policies — access-check the scope's org.
    const orgIds = await getAccessibleOrgIds(c.supabase, c.profile)
    const org = await scopeOrgId(admin, from_scope_type, from_scope_id)
    if (orgIds !== null && (!org || !orgIds.includes(org))) {
      return NextResponse.json({ error: 'No access to that scope' }, { status: 403 })
    }
    items = await captureScopeItems(admin, from_scope_type, from_scope_id)
  }

  const { data: tmpl, error } = await admin.from('policy_templates')
    .insert({ name: name.trim(), description: (description || '').trim() || null, created_by: c.profile.id })
    .select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (items.length) {
    await admin.from('policy_template_items').insert(items.map(i => ({ template_id: tmpl.id, ...i })))
  }
  return NextResponse.json({ success: true, id: tmpl.id, items: items.length })
}
