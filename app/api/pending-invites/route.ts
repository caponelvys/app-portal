import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'

// Verify the requester is a signed-in admin. Returns the admin Supabase client
// (service role) on success, or a NextResponse error to return early.
async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  return { adminClient }
}

export async function GET() {
  const { adminClient, error } = await requireAdmin()
  if (error) return error

  const { data, error: listError } = await adminClient.auth.admin.listUsers()
  if (listError) return NextResponse.json({ error: listError.message }, { status: 400 })

  const pending = data.users.filter(u => u.invited_at && !u.confirmed_at).map(u => ({
    id: u.id,
    email: u.email,
    invited_at: u.invited_at,
    role: (u.user_metadata?.role as string) ?? 'user',
  }))

  return NextResponse.json({ pending })
}

export async function DELETE(req: NextRequest) {
  const { adminClient, error } = await requireAdmin()
  if (error) return error

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'User id is required' }, { status: 400 })

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(id)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
