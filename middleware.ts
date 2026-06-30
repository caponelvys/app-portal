import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // Redirect unauthenticated users to /login (except on auth pages and public agent downloads)
  const pub = ['/login', '/signup', '/reset-password', '/downloads', '/api/enroll', '/auth/callback']
  if (!user && !pub.some(p => path.startsWith(p))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user) {
    // Enforce the 2FA challenge: if the account has a verified factor but the
    // session is still aal1, force the MFA step before anything else.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    const needsMfa = aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2'
    const mfaAllowed = path.startsWith('/login/mfa') || path.startsWith('/auth/signout')
    if (needsMfa && !mfaAllowed) {
      return NextResponse.redirect(new URL('/login/mfa', request.url))
    }

    // Redirect already-authenticated users away from login/signup (but allow /login/mfa)
    if ((path === '/login' || path.startsWith('/signup')) && !needsMfa) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
