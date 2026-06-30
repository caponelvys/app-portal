import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

// OAuth (Microsoft/Google) redirect target. Exchanges the code for a session,
// then enforces invite-only access: a user must already have a provisioned
// profiles row. Unknown accounts are denied and cleaned up.
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  if (!code) return NextResponse.redirect(new URL('/login?error=oauth', url.origin))

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(new URL('/login?error=oauth', url.origin))

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login?error=oauth', url.origin))

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    // Not invited/provisioned — deny and remove the orphaned auth account.
    await supabase.auth.signOut()
    try {
      await createAdminClient().auth.admin.deleteUser(user.id)
    } catch {
      // best-effort cleanup; access is already denied without a profile
    }
    return NextResponse.redirect(new URL('/login?error=not_authorized', url.origin))
  }

  return NextResponse.redirect(new URL('/', url.origin))
}
