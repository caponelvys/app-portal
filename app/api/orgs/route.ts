import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { admin: createAdminClient() }
}

// Create an org, or a location within an org.
export async function POST(req: NextRequest) {
  const { admin, error } = await requireAdmin()
  if (error) return error

  const { kind, name, org_id } = await req.json()
  const trimmed = typeof name === 'string' ? name.trim() : ''
  if (!trimmed) return NextResponse.json({ error: 'A name is required' }, { status: 400 })

  if (kind === 'location') {
    if (!org_id) return NextResponse.json({ error: 'org_id is required for a location' }, { status: 400 })
    const { data, error: insErr } = await admin
      .from('locations')
      .insert({ org_id, name: trimmed })
      .select('id')
      .single()
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 })
    return NextResponse.json({ success: true, id: data.id })
  }

  // default: org
  const { data, error: insErr } = await admin.from('orgs').insert({ name: trimmed }).select('id').single()
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 })
  return NextResponse.json({ success: true, id: data.id })
}
