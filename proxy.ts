import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Session limits. IDLE_MS mirrors the client-side timer in app/SessionTimeout.tsx;
// ABSOLUTE_MS is a hard cap that survives token refreshes via the sessionStart cookie.
const IDLE_MS = 30 * 60 * 1000
const ABSOLUTE_MS = 12 * 60 * 60 * 1000
// sessionStart must outlive the absolute cap, so the timestamp is still present
// for the age check to fire instead of the cookie silently expiring first.
const SESSION_START_MAX_AGE = 24 * 60 * 60

export async function proxy(request: NextRequest) {
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

  // Redirect unauthenticated users to /login (except on auth pages, public agent
  // downloads, and device-authenticated APIs the agent/companion call without a session)
  const pub = ['/login', '/signup', '/reset-password', '/downloads', '/api/enroll', '/api/agent', '/api/device-request', '/auth/callback']
  // The agent also calls /api/devices/<id>/self-remove unauthenticated as the final
  // act of self-uninstall. Allow that exact sub-path without exposing the rest of
  // /api/devices (an authenticated admin surface). Without this the request 307s to
  // /login, the agent's POST follows it, gets a 200 login page, and the device row is
  // never deleted — leaving a ghost device after every uninstall.
  const isPublic = pub.some(p => path.startsWith(p)) ||
    (path.startsWith('/api/devices/') && path.endsWith('/self-remove'))
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user) {
    // Enforce session timeouts before anything else: an expired session must be
    // bounced regardless of MFA state. Idle is driven by the lastActivity cookie
    // (written on real user input by app/SessionTimeout.tsx); the absolute cap is
    // measured from a server-stamped sessionStart cookie that survives refreshes.
    const now = Date.now()
    const started = Number(request.cookies.get('sessionStart')?.value) || 0
    const lastActive = Number(request.cookies.get('lastActivity')?.value) || 0
    const onAuthPath = path.startsWith('/login') || path.startsWith('/auth/signout')

    const idleExpired = lastActive > 0 && now - lastActive > IDLE_MS
    const absoluteExpired = started > 0 && now - started > ABSOLUTE_MS

    if ((idleExpired || absoluteExpired) && !onAuthPath) {
      await supabase.auth.signOut()
      const reason = absoluteExpired ? 'expired' : 'idle'
      const res = NextResponse.redirect(new URL(`/login?timeout=${reason}`, request.url))
      res.cookies.set('sessionStart', '', { path: '/', maxAge: 0 })
      res.cookies.set('lastActivity', '', { path: '/', maxAge: 0 })
      // signOut() cleared the auth cookies on a different response object; clear
      // them on the redirect we actually return so the session can't linger.
      for (const c of request.cookies.getAll()) {
        if (c.name.startsWith('sb-')) res.cookies.set(c.name, '', { path: '/', maxAge: 0 })
      }
      return res
    }

    // Stamp the session start once so the absolute cap is anchored to the real
    // login time, not the last hourly token refresh.
    if (!started) {
      supabaseResponse.cookies.set('sessionStart', String(now), {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: request.nextUrl.protocol === 'https:',
        maxAge: SESSION_START_MAX_AGE,
      })
    }

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
