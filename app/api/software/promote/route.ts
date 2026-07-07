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

// Promote an observed (unmanaged) app into the catalog so it becomes managed and
// enforceable. status 'blocked' → the agent kills it by process_name; 'allowed'
// → it's catalogued but not enforced. Idempotent on name: updates an existing
// catalog app rather than creating a duplicate.
export async function POST(req: NextRequest) {
  const { admin, error } = await requireAdmin()
  if (error) return error

  const body = await req.json()
  const name = (body.name || '').trim()
  const processName = (body.process_name || '').trim()
  const status = body.status
  if (!name || !processName || (status !== 'allowed' && status !== 'blocked')) {
    return NextResponse.json({ error: 'name, process_name and status (allowed|blocked) are required' }, { status: 400 })
  }

  // Fold into an existing catalog app of the same name instead of duplicating.
  const { data: existing } = await admin.from('apps').select('id').ilike('name', name).limit(1).maybeSingle()

  if (existing) {
    const { error: updErr } = await admin.from('apps')
      .update({ process_name: processName, status }).eq('id', existing.id)
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })
    return NextResponse.json({ success: true, id: existing.id, updated: true })
  }

  const { data: created, error: insErr } = await admin.from('apps')
    .insert({ name, process_name: processName, status }).select('id').single()
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 })
  return NextResponse.json({ success: true, id: created.id, updated: false })
}
