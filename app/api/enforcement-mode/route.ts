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

// Which table/key each scope maps to. Device is keyed on device_id (text).
const TARGET: Record<string, { table: string; key: string }> = {
  org:      { table: 'orgs',      key: 'id' },
  location: { table: 'locations', key: 'id' },
  device:   { table: 'devices',   key: 'device_id' },
}

// Set a scope's enforcement mode. mode 'inherit' clears the override (NULL), so
// the scope falls back to its parent (device → location → org → enforce).
export async function POST(req: NextRequest) {
  const { admin, error } = await requireAdmin()
  if (error) return error

  const { scope, scopeId, mode } = await req.json()
  const target = TARGET[scope]
  if (!target || !scopeId || !['enforce', 'learn', 'inherit'].includes(mode)) {
    return NextResponse.json({ error: 'valid scope, scopeId and mode (enforce|learn|inherit) are required' }, { status: 400 })
  }

  const value = mode === 'inherit' ? null : mode
  const { error: updErr } = await admin
    .from(target.table)
    .update({ enforcement_mode: value })
    .eq(target.key, scopeId)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })

  return NextResponse.json({ success: true, mode: value })
}
