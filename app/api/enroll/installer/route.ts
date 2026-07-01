import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, isMspStaff } from '@/lib/rbac'

// Per-location installer download. Fetches the base installer script and bakes
// the location's enrollment token into it, so the downloaded file self-enrolls
// with no arguments. The token is looked up server-side and never appears in
// the URL. MSP staff only.
const OS_MAP: Record<string, { file: string; find: RegExp; repl: (t: string) => string }> = {
  windows: { file: 'install_win.bat',   find: /set "TOKEN="/, repl: t => `set "TOKEN=${t}"` },
  mac:     { file: 'install_mac.sh',    find: /TOKEN=""/,     repl: t => `TOKEN="${t}"` },
  linux:   { file: 'install_linux.sh',  find: /TOKEN=""/,     repl: t => `TOKEN="${t}"` },
}

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const profile = await getCallerProfile(supabase)
  if (!profile || !isMspStaff(profile)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const os = req.nextUrl.searchParams.get('os') ?? ''
  const locId = req.nextUrl.searchParams.get('loc') ?? ''
  const spec = OS_MAP[os]
  if (!spec || !locId) {
    return new NextResponse('os (windows|mac|linux) and loc are required', { status: 400 })
  }

  const admin = createAdminClient()
  const { data: loc, error } = await admin
    .from('locations')
    .select('enrollment_token')
    .eq('id', locId)
    .maybeSingle()
  if (error) return new NextResponse(`Lookup failed: ${error.message}`, { status: 500 })
  const token = loc?.enrollment_token
  if (!token) return new NextResponse('Location has no enrollment token', { status: 404 })

  // Base scripts live in /public/downloads; fetch over HTTP so this works the
  // same in dev and on Vercel (public assets are CDN-served, not on the fn fs).
  const base = await fetch(`${req.nextUrl.origin}/downloads/${spec.file}`, { cache: 'no-store' })
  if (!base.ok) return new NextResponse('Base installer unavailable', { status: 502 })

  const script = await base.text()
  const injected = script.replace(spec.find, spec.repl(token))
  if (injected === script) {
    // Token line not found — surface it instead of shipping a token-less installer.
    return new NextResponse('Failed to embed enrollment token into installer', { status: 500 })
  }

  return new NextResponse(injected, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${spec.file}"`,
      'Cache-Control': 'no-store',
    },
  })
}
