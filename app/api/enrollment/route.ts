import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
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

// Rotate a location's enrollment token. Old install commands stop enrolling.
export async function POST(req: NextRequest) {
  const { admin, error } = await requireAdmin()
  if (error) return error

  const { location_id } = await req.json()
  if (!location_id) return NextResponse.json({ error: 'location_id is required' }, { status: 400 })

  const token = 'loc_' + randomBytes(12).toString('hex')
  const { error: updErr } = await admin
    .from('locations')
    .update({ enrollment_token: token })
    .eq('id', location_id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })

  return NextResponse.json({ success: true, token })
}
