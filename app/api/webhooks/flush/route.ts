import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, isMspStaff } from '@/lib/rbac'
import { forwardAll } from '@/lib/webhooks'

// The scheduled forwarder. Authorized by the Vercel Cron secret
// (Authorization: Bearer $CRON_SECRET) or an msp-staff session (manual flush).
// If CRON_SECRET is unset the cron runs open, like expire-grants — harmless, it
// only delivers to admin-configured endpoints.
async function authorized(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') === `Bearer ${secret}`) return true
  const profile = await getCallerProfile(await createServerClient())
  if (profile && isMspStaff(profile)) return true
  return !secret
}

async function handle(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const result = await forwardAll(createAdminClient())
  return NextResponse.json({ success: true, ...result })
}

export async function GET(req: NextRequest) { return handle(req) }
export async function POST(req: NextRequest) { return handle(req) }
