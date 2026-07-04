import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { getCallerProfile, isMspStaff } from '@/lib/rbac'
import { enqueueAppCommand, COMMAND_SCOPES, type CommandScope } from '@/lib/deviceCommands'

// Queue a remote install of one app across a scope (device/location/org/fleet).
// MSP staff only; scope access is enforced in enqueueAppCommand. The agent needs
// the app's mac_install_url set to actually install (macOS .pkg in v1).
export async function POST(req: NextRequest, { params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params
  const supabase = await createServerClient()
  const profile = await getCallerProfile(supabase)
  if (!profile || !isMspStaff(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { scope, scopeId } = await req.json().catch(() => ({})) as { scope?: CommandScope; scopeId?: string }
  if (!scope || !COMMAND_SCOPES.includes(scope)) {
    return NextResponse.json({ error: `scope must be one of: ${COMMAND_SCOPES.join(', ')}` }, { status: 400 })
  }

  const res = await enqueueAppCommand({ appId, type: 'install_app', scope, scopeId, profile, supabase })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
  return NextResponse.json({ success: true, queued: res.queued, app: res.app })
}
