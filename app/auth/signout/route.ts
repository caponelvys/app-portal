import { createClient } from '@/lib/supabase-server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()

  // Clear the session-timeout tracking cookies too, otherwise a stale
  // sessionStart could immediately expire the next login (see proxy.ts).
  const res = NextResponse.redirect(new URL('/login', request.url))
  res.cookies.set('sessionStart', '', { path: '/', maxAge: 0 })
  res.cookies.set('lastActivity', '', { path: '/', maxAge: 0 })
  return res
}
